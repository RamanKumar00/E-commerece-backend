import { CourierPartner } from '../../models/courierPartnerSchema.js';
import { Shipment } from '../../models/shipmentSchema.js';
import { TrackingLog } from '../../models/trackingLogSchema.js';
import ShiprocketService from './ShiprocketService.js';
// Import other courier services when implemented
// import DelhiveryService from './DelhiveryService.js';
// import ShadowfaxService from './ShadowfaxService.js';

/**
 * Courier Manager - Central service to manage all courier operations
 */
class CourierManager {
  constructor() {
    this.services = new Map();
  }

  /**
   * Initialize courier services from database configuration
   */
  async initialize() {
    try {
      const partners = await CourierPartner.find({ isActive: true })
        .select('+credentials.apiKey +credentials.apiSecret +credentials.token');

      for (const partner of partners) {
        const service = this.createServiceInstance(partner);
        if (service) {
          this.services.set(partner.name, service);
        }
      }

      console.log(`✅ Initialized ${this.services.size} courier services`);
    } catch (error) {
      console.error('❌ Failed to initialize courier services:', error);
    }
  }

  /**
   * Create service instance based on courier name
   */
  createServiceInstance(partner) {
    const config = {
      apiBaseUrl: partner.apiBaseUrl,
      credentials: {
        email: partner.credentials?.email,
        password: partner.credentials?.password,
        apiKey: partner.credentials?.apiKey,
        apiSecret: partner.credentials?.apiSecret,
        token: partner.credentials?.token,
        tokenExpiry: partner.credentials?.tokenExpiry,
      },
      webhookSecret: partner.configuration?.webhookSecret,
      timeoutSeconds: partner.configuration?.timeoutSeconds,
      maxRetries: partner.configuration?.maxRetries,
    };

    switch (partner.name) {
      case 'Shiprocket':
        return new ShiprocketService(config);
      // case 'Delhivery':
      //   return new DelhiveryService(config);
      // case 'Shadowfax':
      //   return new ShadowfaxService(config);
      default:
        console.warn(`Unknown courier partner: ${partner.name}`);
        return null;
    }
  }

  /**
   * Get service instance by name
   */
  getService(courierName) {
    const service = this.services.get(courierName);
    if (!service) {
      throw new Error(`Courier service not found: ${courierName}`);
    }
    return service;
  }

  /**
   * Check serviceability across all couriers
   */
  async checkServiceability(pickupPincode, deliveryPincode, cod = false) {
    const results = [];

    for (const [name, service] of this.services) {
      try {
        const result = await service.checkServiceability({
          pickupPincode,
          deliveryPincode,
          cod,
        });

        results.push({
          courierName: name,
          ...result,
        });
      } catch (error) {
        console.error(`Serviceability check failed for ${name}:`, error.message);
      }
    }

    return results;
  }

  /**
   * Get rates from all couriers
   */
  async getAllRates(params) {
    const allRates = [];

    for (const [name, service] of this.services) {
      try {
        const rates = await service.getRates(params);
        allRates.push(...rates.map(rate => ({
          ...rate,
          courierService: name,
        })));
      } catch (error) {
        console.error(`Rate fetch failed for ${name}:`, error.message);
      }
    }

    // Sort by total charge
    return allRates.sort((a, b) => a.totalCharge - b.totalCharge);
  }

  /**
   * Smart courier selection based on multiple factors
   */
  async recommendCourier(params) {
    const { pickupPincode, deliveryPincode, weight, cod, codAmount, priority } = params;

    // Get all rates
    const rates = await this.getAllRates({
      pickupPincode,
      deliveryPincode,
      weight,
      cod,
      codAmount,
    });

    if (rates.length === 0) {
      return null;
    }

    // Get performance data for each courier
    const partners = await CourierPartner.find({ isActive: true });
    const performanceMap = new Map();
    partners.forEach(p => {
      performanceMap.set(p.name, {
        onTimeRate: p.performance.onTimeDeliveryRate || 0,
        rtoRate: p.getRTORate(),
        avgDays: p.performance.averageDeliveryDays || 999,
      });
    });

    // Calculate scores
    const scoredRates = rates.map(rate => {
      const perf = performanceMap.get(rate.courierService) || {};
      
      // Scoring factors
      const costScore = 100 - (rate.totalCharge / rates[0].totalCharge) * 100;
      const speedScore = (7 - parseInt(rate.estimatedDays || 7)) * 10;
      const reliabilityScore = perf.onTimeRate || 50;
      const rtoScore = 100 - (perf.rtoRate || 10);

      // Weighted score based on priority
      let score;
      if (priority === 'Urgent') {
        score = speedScore * 0.5 + reliabilityScore * 0.3 + costScore * 0.2;
      } else if (priority === 'High') {
        score = speedScore * 0.4 + reliabilityScore * 0.4 + costScore * 0.2;
      } else {
        score = costScore * 0.4 + reliabilityScore * 0.3 + speedScore * 0.3;
      }

      return {
        ...rate,
        score: score,
        performance: perf,
      };
    });

    // Return top recommendation
    scoredRates.sort((a, b) => b.score - a.score);
    return scoredRates[0];
  }

  /**
   * Create shipment with specified courier
   */
  async createShipment(courierName, shipmentData, orderId) {
    try {
      const service = this.getService(courierName);
      const partner = await CourierPartner.findOne({ name: courierName });

      if (!partner) {
        throw new Error(`Courier partner not found: ${courierName}`);
      }

      // Create shipment via courier API
      const result = await service.createShipment(shipmentData);

      if (!result.success) {
        throw new Error('Shipment creation failed');
      }

      // Save to database
      const shipment = await Shipment.create({
        orderId: orderId,
        courierId: partner._id,
        courierName: courierName,
        awbNumber: result.awbNumber,
        trackingNumber: result.trackingNumber,
        shipmentStatus: 'Created',
        shipmentDetails: {
          weight: shipmentData.weight,
          length: shipmentData.dimensions?.length,
          breadth: shipmentData.dimensions?.breadth,
          height: shipmentData.dimensions?.height,
          numberOfPackages: 1,
          isCOD: shipmentData.paymentMethod === 'COD',
          codAmount: shipmentData.paymentMethod === 'COD' ? shipmentData.codAmount : 0,
        },
        deliveryDetails: {
          deliveryAddress: shipmentData.shipping,
        },
        courierResponse: {
          createResponse: result.response,
        },
      });

      // Log initial tracking
      await TrackingLog.create({
        shipmentId: shipment._id,
        awbNumber: result.awbNumber,
        status: 'Created',
        description: 'Shipment created successfully',
        timestamp: new Date(),
        source: 'API',
        courierName: courierName,
      });

      // Update partner stats
      partner.performance.totalShipments += 1;
      await partner.save();

      return {
        success: true,
        shipment: shipment,
        awbNumber: result.awbNumber,
        trackingNumber: result.trackingNumber,
      };
    } catch (error) {
      throw new Error(`Failed to create shipment: ${error.message}`);
    }
  }

  /**
   * Track shipment
   */
  async trackShipment(awbNumber) {
    try {
      const shipment = await Shipment.findOne({ awbNumber }).populate('courierId');

      if (!shipment) {
        throw new Error('Shipment not found');
      }

      const service = this.getService(shipment.courierName);
      const trackingData = await service.trackShipment(awbNumber);

      if (trackingData) {
        // Update shipment status
        shipment.shipmentStatus = trackingData.currentStatus;
        shipment.currentLocation = trackingData.currentLocation;
        if (trackingData.estimatedDelivery) {
          shipment.deliveryDetails.estimatedDeliveryDate = trackingData.estimatedDelivery;
        }
        if (trackingData.deliveredDate && trackingData.currentStatus === 'Delivered') {
          shipment.deliveryDetails.actualDeliveryDate = trackingData.deliveredDate;
        }
        await shipment.save();

        // Log tracking update
        await TrackingLog.create({
          shipmentId: shipment._id,
          awbNumber: awbNumber,
          status: trackingData.currentStatus,
          location: trackingData.currentLocation,
          description: trackingData.history[0]?.description || '',
          timestamp: new Date(),
          source: 'API',
          courierName: shipment.courierName,
          rawData: trackingData.rawData,
        });

        return {
          shipment: shipment,
          tracking: trackingData,
        };
      }

      return null;
    } catch (error) {
      throw new Error(`Tracking failed: ${error.message}`);
    }
  }

  /**
   * Cancel shipment
   */
  async cancelShipment(awbNumber, reason) {
    try {
      const shipment = await Shipment.findOne({ awbNumber });

      if (!shipment) {
        throw new Error('Shipment not found');
      }

      if (['Delivered', 'Cancelled'].includes(shipment.shipmentStatus)) {
        throw new Error(`Cannot cancel shipment with status: ${shipment.shipmentStatus}`);
      }

      const service = this.getService(shipment.courierName);
      const result = await service.cancelShipment(awbNumber);

      if (result.success) {
        shipment.shipmentStatus = 'Cancelled';
        shipment.cancelledAt = new Date();
        shipment.cancellationReason = reason;
        shipment.courierResponse.cancelResponse = result.response;
        await shipment.save();

        // Log cancellation
        await TrackingLog.create({
          shipmentId: shipment._id,
          awbNumber: awbNumber,
          status: 'Cancelled',
          description: `Shipment cancelled: ${reason}`,
          timestamp: new Date(),
          source: 'Manual',
          courierName: shipment.courierName,
        });

        return { success: true, shipment };
      }

      return { success: false, message: result.message };
    } catch (error) {
      throw new Error(`Cancellation failed: ${error.message}`);
    }
  }

  /**
   * Process webhook from courier
   */
  async processWebhook(courierName, payload, signature) {
    try {
      const service = this.getService(courierName);

      // Validate webhook
      if (!service.validateWebhook(payload, signature)) {
        throw new Error('Invalid webhook signature');
      }

      // Process webhook
      const update = await service.processWebhook(payload);

      // Find shipment
      const shipment = await Shipment.findOne({ awbNumber: update.awbNumber });

      if (shipment) {
        // Update shipment
        shipment.shipmentStatus = update.status;
        if (update.location) {
          shipment.currentLocation = update.location;
        }
        await shipment.save();

        // Log update
        await TrackingLog.create({
          shipmentId: shipment._id,
          awbNumber: update.awbNumber,
          status: update.status,
          location: update.location,
          description: update.description,
          timestamp: update.timestamp,
          source: 'Webhook',
          courierName: courierName,
          rawData: update.rawData,
        });

        // Update partner performance if delivered
        if (update.status === 'Delivered') {
          const partner = await CourierPartner.findById(shipment.courierId);
          if (partner) {
            partner.performance.successfulDeliveries += 1;
            
            // Check if on-time
            const daysInTransit = shipment.getDaysInTransit();
            if (daysInTransit <= (shipment.deliveryDetails.estimatedDeliveryDate ? 
                Math.ceil((new Date(shipment.deliveryDetails.estimatedDeliveryDate) - new Date(shipment.createdAt)) / (1000 * 60 * 60 * 24)) : 7)) {
              // On-time delivery
              const currentRate = partner.performance.onTimeDeliveryRate || 0;
              const total = partner.performance.successfulDeliveries;
              partner.performance.onTimeDeliveryRate = ((currentRate * (total - 1) + 100) / total);
            }
            
            await partner.save();
          }
        }

        return { success: true, shipment };
      }

      return { success: false, message: 'Shipment not found' };
    } catch (error) {
      console.error('Webhook processing error:', error);
      throw error;
    }
  }

  /**
   * Get tracking history
   */
  async getTrackingHistory(awbNumber) {
    const logs = await TrackingLog.find({ awbNumber })
      .sort({ timestamp: -1 })
      .limit(50);

    return logs;
  }

  /**
   * Get courier performance stats
   */
  async getPerformanceStats() {
    const partners = await CourierPartner.find({ isActive: true });

    return partners.map(partner => ({
      name: partner.name,
      totalShipments: partner.performance.totalShipments,
      successfulDeliveries: partner.performance.successfulDeliveries,
      failedDeliveries: partner.performance.failedDeliveries,
      rtoCount: partner.performance.rtoCount,
      avgDeliveryDays: partner.performance.averageDeliveryDays,
      onTimeRate: partner.performance.onTimeDeliveryRate,
      deliverySuccessRate: partner.getDeliverySuccessRate(),
      rtoRate: partner.getRTORate(),
    }));
  }
}

// Singleton instance
const courierManager = new CourierManager();

export default courierManager;
