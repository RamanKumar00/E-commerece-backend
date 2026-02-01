/**
 * Base Courier Service Class
 * This abstract class defines the interface that all courier adapters must implement
 */
class CourierService {
  constructor(config) {
    this.config = config;
    this.name = "BaseCourier";
  }

  /**
   * Authenticate and get access token
   * @returns {Promise<string>} Access token
   */
  async authenticate() {
    throw new Error("authenticate() must be implemented by courier adapter");
  }

  /**
   * Check if pincode is serviceable
   * @param {Object} params - {pickupPincode, deliveryPincode, cod}
   * @returns {Promise<Object>} {serviceable, estimatedDays, serviceTypes}
   */
  async checkServiceability(params) {
    throw new Error("checkServiceability() must be implemented by courier adapter");
  }

  /**
   * Get shipping rates
   * @param {Object} params - {pickupPincode, deliveryPincode, weight, cod, codAmount}
   * @returns {Promise<Array>} Array of rate options
   */
  async getRates(params) {
    throw new Error("getRates() must be implemented by courier adapter");
  }

  /**
   * Create shipment and generate AWB
   * @param {Object} shipmentData - Complete shipment details
   * @returns {Promise<Object>} {awbNumber, trackingNumber, labels, response}
   */
  async createShipment(shipmentData) {
    throw new Error("createShipment() must be implemented by courier adapter");
  }

  /**
   * Track shipment by AWB
   * @param {string} awbNumber - AWB tracking number
   * @returns {Promise<Object>} {status, location, history, estimatedDelivery}
   */
  async trackShipment(awbNumber) {
    throw new Error("trackShipment() must be implemented by courier adapter");
  }

  /**
   * Cancel shipment
   * @param {string} awbNumber - AWB tracking number
   * @returns {Promise<Object>} {success, message}
   */
  async cancelShipment(awbNumber) {
    throw new Error("cancelShipment() must be implemented by courier adapter");
  }

  /**
   * Generate shipping label
   * @param {string} awbNumber - AWB tracking number
   * @returns {Promise<string>} Label URL or base64
   */
  async generateLabel(awbNumber) {
    throw new Error("generateLabel() must be implemented by courier adapter");
  }

  /**
   * Schedule pickup
   * @param {Object} pickupData - Pickup details
   * @returns {Promise<Object>} {pickupId, scheduledDate}
   */
  async schedulePickup(pickupData) {
    throw new Error("schedulePickup() must be implemented by courier adapter");
  }

  /**
   * Validate webhook signature
   * @param {Object} payload - Webhook payload
   * @param {string} signature - Webhook signature
   * @returns {boolean} Is valid
   */
  validateWebhook(payload, signature) {
    throw new Error("validateWebhook() must be implemented by courier adapter");
  }

  /**
   * Process webhook event
   * @param {Object} payload - Webhook payload
   * @returns {Promise<Object>} Processed tracking update
   */
  async processWebhook(payload) {
    throw new Error("processWebhook() must be implemented by courier adapter");
  }

  /**
   * Standardize status from courier-specific to our system
   * @param {string} courierStatus - Courier's status code
   * @returns {string} Standardized status
   */
  standardizeStatus(courierStatus) {
    // Default mapping - override in child class
    const statusMap = {
      "created": "Created",
      "pickup_scheduled": "Pickup Scheduled",
      "picked_up": "Picked Up",
      "in_transit": "In Transit",
      "out_for_delivery": "Out for Delivery",
      "delivered": "Delivered",
      "failed": "Failed Attempt",
      "rto": "RTO Initiated",
      "cancelled": "Cancelled",
    };

    return statusMap[courierStatus?.toLowerCase()] || courierStatus;
  }

  /**
   * Helper: Make HTTP request with retry logic
   */
  async makeRequest(method, url, data = null, headers = {}, retries = 3) {
    const https = await import('https');
    const http = await import('http');
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        const options = {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          timeout: (this.config.timeoutSeconds || 30) * 1000,
        };

        return await new Promise((resolve, reject) => {
          const req = protocol.request(urlObj, options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
              responseData += chunk;
            });

            res.on('end', () => {
              try {
                const parsed = JSON.parse(responseData);
                if (res.statusCode >= 200 && res.statusCode < 300) {
                  resolve(parsed);
                } else {
                  reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
                }
              } catch (e) {
                reject(new Error(`Invalid JSON response: ${responseData}`));
              }
            });
          });

          req.on('error', reject);
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
          });

          if (data) {
            req.write(JSON.stringify(data));
          }

          req.end();
        });
      } catch (error) {
        if (attempt === retries - 1) {
          throw error;
        }
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  /**
   * Helper: Calculate volumetric weight
   */
  calculateVolumetricWeight(length, breadth, height, divisor = 5000) {
    return (length * breadth * height) / divisor;
  }

  /**
   * Helper: Get billable weight
   */
  getBillableWeight(actualWeight, length, breadth, height) {
    const volumetricWeight = this.calculateVolumetricWeight(length, breadth, height);
    return Math.max(actualWeight, volumetricWeight);
  }

  /**
   * Helper: Format phone number
   */
  formatPhone(phone) {
    // Remove all non-digit characters
    return phone.replace(/\D/g, '');
  }

  /**
   * Helper: Validate pincode
   */
  validatePincode(pincode) {
    return /^[1-9][0-9]{5}$/.test(pincode);
  }
}

export default CourierService;
