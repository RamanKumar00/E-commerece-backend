import CourierService from './BaseCourierService.js';
import crypto from 'crypto';

/**
 * Shiprocket Courier Integration
 * API Documentation: https://apidocs.shiprocket.in/
 */
class ShiprocketService extends CourierService {
  constructor(config) {
    super(config);
    this.name = "Shiprocket";
    this.baseUrl = config.apiBaseUrl || "https://apiv2.shiprocket.in/v1/external";
    this.email = config.credentials?.email;
    this.password = config.credentials?.password;
    this.token = config.credentials?.token;
    this.tokenExpiry = config.credentials?.tokenExpiry;
  }

  /**
   * Authenticate with Shiprocket and get token
   */
  async authenticate() {
    if (this.token && this.tokenExpiry && new Date() < new Date(this.tokenExpiry)) {
      return this.token;
    }

    try {
      const response = await this.makeRequest(
        'POST',
        `${this.baseUrl}/auth/login`,
        {
          email: this.email,
          password: this.password,
        }
      );

      this.token = response.token;
      // Token valid for 10 days
      this.tokenExpiry = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

      return this.token;
    } catch (error) {
      throw new Error(`Shiprocket authentication failed: ${error.message}`);
    }
  }

  /**
   * Get authorization headers
   */
  async getHeaders() {
    const token = await this.authenticate();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Check pincode serviceability
   */
  async checkServiceability({ pickupPincode, deliveryPincode, cod = false }) {
    try {
      const headers = await this.getHeaders();
      const response = await this.makeRequest(
        'GET',
        `${this.baseUrl}/courier/serviceability/?pickup_postcode=${pickupPincode}&delivery_postcode=${deliveryPincode}&cod=${cod ? 1 : 0}&weight=1`,
        null,
        headers
      );

      if (response.status === 200 && response.data?.available_courier_companies) {
        return {
          serviceable: response.data.available_courier_companies.length > 0,
          estimatedDays: response.data.available_courier_companies[0]?.etd || null,
          serviceTypes: response.data.available_courier_companies.map(c => ({
            name: c.courier_name,
            type: c.courier_type,
            estimatedDays: c.etd,
            rate: c.rate,
            codAvailable: c.is_cod_available,
          })),
        };
      }

      return { serviceable: false, estimatedDays: null, serviceTypes: [] };
    } catch (error) {
      throw new Error(`Shiprocket serviceability check failed: ${error.message}`);
    }
  }

  /**
   * Get shipping rates
   */
  async getRates({ pickupPincode, deliveryPincode, weight, cod = false, codAmount = 0 }) {
    try {
      const headers = await this.getHeaders();
      const response = await this.makeRequest(
        'GET',
        `${this.baseUrl}/courier/serviceability/?pickup_postcode=${pickupPincode}&delivery_postcode=${deliveryPincode}&cod=${cod ? 1 : 0}&weight=${weight}`,
        null,
        headers
      );

      if (response.data?.available_courier_companies) {
        return response.data.available_courier_companies.map(courier => ({
          courierName: courier.courier_name,
          courierType: courier.courier_type,
          rate: courier.rate,
          estimatedDays: courier.etd,
          codAvailable: courier.is_cod_available,
          codCharges: courier.cod_charges || 0,
          minWeight: courier.min_weight,
          description: courier.description,
          totalCharge: courier.rate + (cod ? (courier.cod_charges || 0) : 0),
        }));
      }

      return [];
    } catch (error) {
      throw new Error(`Shiprocket rate fetch failed: ${error.message}`);
    }
  }

  /**
   * Create shipment
   */
  async createShipment(shipmentData) {
    try {
      const headers = await this.getHeaders();
      
      const payload = {
        order_id: shipmentData.orderId,
        order_date: new Date().toISOString().split('T')[0],
        pickup_location: "Primary",
        channel_id: "",
        comment: shipmentData.notes || "",
        billing_customer_name: shipmentData.billing.name,
        billing_last_name: "",
        billing_address: shipmentData.billing.address,
        billing_city: shipmentData.billing.city,
        billing_pincode: shipmentData.billing.pincode,
        billing_state: shipmentData.billing.state,
        billing_country: "India",
        billing_email: shipmentData.billing.email || "customer@example.com",
        billing_phone: this.formatPhone(shipmentData.billing.phone),
        shipping_is_billing: true,
        shipping_customer_name: shipmentData.shipping.name,
        shipping_last_name: "",
        shipping_address: shipmentData.shipping.address,
        shipping_city: shipmentData.shipping.city,
        shipping_pincode: shipmentData.shipping.pincode,
        shipping_country: "India",
        shipping_state: shipmentData.shipping.state,
        shipping_email: shipmentData.shipping.email || "customer@example.com",
        shipping_phone: this.formatPhone(shipmentData.shipping.phone),
        order_items: shipmentData.items.map(item => ({
          name: item.name,
          sku: item.sku || item.productId,
          units: item.quantity,
          selling_price: item.price,
          discount: item.discount || 0,
          tax: item.tax || 0,
          hsn: item.hsn || "",
        })),
        payment_method: shipmentData.paymentMethod === "COD" ? "COD" : "Prepaid",
        shipping_charges: shipmentData.shippingCharges || 0,
        giftwrap_charges: 0,
        transaction_charges: 0,
        total_discount: shipmentData.discount || 0,
        sub_total: shipmentData.subTotal,
        length: shipmentData.dimensions?.length || 10,
        breadth: shipmentData.dimensions?.breadth || 10,
        height: shipmentData.dimensions?.height || 10,
        weight: shipmentData.weight,
      };

      const response = await this.makeRequest(
        'POST',
        `${this.baseUrl}/orders/create/adhoc`,
        payload,
        headers
      );

      if (response.order_id && response.shipment_id) {
        // Now generate AWB
        const awbResponse = await this.makeRequest(
          'POST',
          `${this.baseUrl}/courier/assign/awb`,
          {
            shipment_id: response.shipment_id,
            courier_id: shipmentData.courierId || null, // Auto-assign if null
          },
          headers
        );

        return {
          success: true,
          orderId: response.order_id,
          shipmentId: response.shipment_id,
          awbNumber: awbResponse.response?.data?.awb_code,
          trackingNumber: awbResponse.response?.data?.awb_code,
          courierName: awbResponse.response?.data?.courier_name,
          label: null, // Generate separately
          response: {
            orderResponse: response,
            awbResponse: awbResponse,
          },
        };
      }

      throw new Error("Failed to create shipment");
    } catch (error) {
      throw new Error(`Shiprocket shipment creation failed: ${error.message}`);
    }
  }

  /**
   * Track shipment
   */
  async trackShipment(awbNumber) {
    try {
      const headers = await this.getHeaders();
      const response = await this.makeRequest(
        'GET',
        `${this.baseUrl}/courier/track/awb/${awbNumber}`,
        null,
        headers
      );

      if (response.tracking_data) {
        const data = response.tracking_data;
        const activities = data.shipment_track_activities || [];

        return {
          awbNumber: awbNumber,
          currentStatus: this.standardizeStatus(data.shipment_status),
          currentLocation: {
            city: activities[0]?.location || "",
            state: "",
            country: "India",
          },
          estimatedDelivery: data.edd,
          deliveredDate: data.delivered_date,
          history: activities.map(activity => ({
            status: activity.activity,
            location: activity.location,
            timestamp: activity.date,
            description: activity.activity,
          })),
          rawData: data,
        };
      }

      return null;
    } catch (error) {
      throw new Error(`Shiprocket tracking failed: ${error.message}`);
    }
  }

  /**
   * Cancel shipment
   */
  async cancelShipment(awbNumber) {
    try {
      const headers = await this.getHeaders();
      
      // First get shipment ID from AWB
      const trackResponse = await this.trackShipment(awbNumber);
      if (!trackResponse) {
        throw new Error("Shipment not found");
      }

      const response = await this.makeRequest(
        'POST',
        `${this.baseUrl}/orders/cancel`,
        {
          ids: [trackResponse.rawData.shipment_id],
        },
        headers
      );

      return {
        success: response.message === "Shipment cancelled successfully",
        message: response.message,
        response: response,
      };
    } catch (error) {
      throw new Error(`Shiprocket cancellation failed: ${error.message}`);
    }
  }

  /**
   * Generate shipping label
   */
  async generateLabel(shipmentId) {
    try {
      const headers = await this.getHeaders();
      const response = await this.makeRequest(
        'POST',
        `${this.baseUrl}/courier/generate/label`,
        {
          shipment_id: [shipmentId],
        },
        headers
      );

      return {
        labelUrl: response.label_url,
        invoiceUrl: response.invoice_url,
      };
    } catch (error) {
      throw new Error(`Shiprocket label generation failed: ${error.message}`);
    }
  }

  /**
   * Schedule pickup
   */
  async schedulePickup(pickupData) {
    try {
      const headers = await this.getHeaders();
      const response = await this.makeRequest(
        'POST',
        `${this.baseUrl}/courier/generate/pickup`,
        {
          shipment_id: [pickupData.shipmentId],
        },
        headers
      );

      return {
        success: response.pickup_scheduled === 1,
        pickupId: response.response?.pickup_token_number,
        scheduledDate: response.response?.pickup_scheduled_date,
        response: response,
      };
    } catch (error) {
      throw new Error(`Shiprocket pickup scheduling failed: ${error.message}`);
    }
  }

  /**
   * Validate webhook signature
   */
  validateWebhook(payload, signature) {
    // Shiprocket uses HMAC SHA256
    const secret = this.config.webhookSecret;
    if (!secret) return true; // Skip validation if no secret configured

    const hash = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return hash === signature;
  }

  /**
   * Process webhook
   */
  async processWebhook(payload) {
    // Shiprocket webhook structure
    return {
      awbNumber: payload.awb,
      status: this.standardizeStatus(payload.current_status),
      location: {
        city: payload.current_location || "",
        state: "",
      },
      timestamp: new Date(payload.updated_at || Date.now()),
      description: payload.current_status_body || "",
      rawData: payload,
    };
  }

  /**
   * Standardize Shiprocket status
   */
  standardizeStatus(shiprocketStatus) {
    const statusMap = {
      "NEW": "Created",
      "PICKUP SCHEDULED": "Pickup Scheduled",
      "PICKED UP": "Picked Up",
      "IN TRANSIT": "In Transit",
      "OUT FOR DELIVERY": "Out for Delivery",
      "DELIVERED": "Delivered",
      "UNDELIVERED": "Failed Attempt",
      "RTO INITIATED": "RTO Initiated",
      "RTO DELIVERED": "RTO Delivered",
      "CANCELED": "Cancelled",
      "LOST": "Lost",
      "DAMAGED": "Damaged",
    };

    return statusMap[shiprocketStatus?.toUpperCase()] || shiprocketStatus;
  }
}

export default ShiprocketService;
