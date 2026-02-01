# 🔧 Courier Partner Setup Guide

## Quick Start - Setting Up Courier Partners

### 1. Database Initialization

Run this script to create initial courier partner configuration:

```javascript
// scripts/setupCouriers.js
import mongoose from'mongoose';
import { CourierPartner } from '../models/courierPartnerSchema.js';

async function setupCouriers() {
  await mongoose.connect(process.env.MONGO_URI);

  // Shiprocket Setup
  await CourierPartner.create({
    name: "Shiprocket",
    displayName: "Shiprocket",
    apiBaseUrl: "https://apiv2.shiprocket.in/v1/external",
    credentials: {
      email: "your-email@example.com",  // UPDATE THIS
      password: "your-password",         // UPDATE THIS
      apiKey: null,
      apiSecret: null,
      token: null,
      tokenExpiry: null,
    },
    isActive: true,
    supportedServices: ["Standard", "Express", "Surface", "Air"],
    configuration: {
      webhookUrl: "https://your-domain.com/api/v1/courier/webhook/Shiprocket",
      webhookSecret: "your-webhook-secret",  // Generate random string
      allowedIPs: [],
      maxRetries: 3,
      timeoutSeconds: 30,
    },
    performance: {
      totalShipments: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      rtoCount: 0,
      averageDeliveryDays: 4,
      onTimeDeliveryRate: 90,
      lastUpdated: new Date(),
    },
    pricing: {
      baseFee: 40,
      perKgRate: 20,
      codCharges: 25,
      rtoCharges: 50,
    },
  });

  console.log('✅ Courier partners created successfully');
  process.exit(0);
}

setupCouriers();
```

**Run:**
```bash
node scripts/setupCouriers.js
```

---

## 2. Shiprocket Configuration

### **Get API Credentials:**

1. Sign up at https://www.shiprocket.in/
2. Go to Settings → API
3. Note down your:
   - Email
   - Password
4. Update in database

### **Configure Webhook:**

1. In Shiprocket dashboard: Settings → Webhooks
2. Add webhook URL:
   ```
   https://your-backend-url.com/api/v1/courier/webhook/Shiprocket
   ```
3. Select events:
   - Order Picked Up
   - In Transit
   - Out for Delivery
   - Delivered
   - RTO Initiated

4. Generate Webhook Secret and update in database

---

## 3. Testing the Integration

### **Step 1: Check Authentication**
```bash
curl -X POST http://localhost:4000/api/v1/courier/check-service \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "pickupPincode": "110001",
    "deliveryPincode": "400001",
    "cod": false
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "serviceable": true,
    "couriers": [
      {
        "courierName": "Shiprocket",
        "serviceable": true,
        "estimatedDays": "4-5"
      }
    ]
  }
}
```

---

### **Step 2: Get Rates**
```bash
curl -X GET "http://localhost:4000/api/v1/courier/rates?pickupPincode=110001&deliveryPincode=400001&weight=1&cod=false" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

### **Step 3: Create Test Shipment**

```bash
curl -X POST http://localhost:4000/api/v1/courier/create-shipment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "orderId": "YOUR_ORDER_ID",
    "autoSelect": true
  }'
```

---

### **Step 4: Track Shipment**
```bash
curl -X GET http://localhost:4000/api/v1/courier/track/AWB_NUMBER
```

---

## 4. Environment Variables

Add to `.env`:

```env
# Courier Settings
SHIPROCKET_EMAIL=your-email@example.com
SHIPROCKET_PASSWORD=your-password
SHIPROCKET_WEBHOOK_SECRET=random-webhook-secret

# Optional: For other couriers
DELHIVERY_API_KEY=
SHADOWFAX_API_KEY=
```

---

## 5. Production Deployment

### **Pre-Deployment Checklist:**

- [ ] Update courier credentials in production database
- [ ] Configure webhook URLs with production domain
- [ ] Test serviceability across pin codes
- [ ] Verify webhook signature validation
- [ ] Set up error alerting (Sentry, etc.)
- [ ] Enable API request logging
- [ ] Configure IP whitelisting for webhooks
- [ ] Test with sandbox/test mode first

### **Monitoring:**

```javascript
// Add to your monitoring dashboard
{
  "metricsToTrack": [
    "Total shipments created",
    "Average shipment creation time",
    "Webhook latency",
    "Failed shipment attempts",
    "Courier API success rate",
    "Average delivery time per courier"
  ]
}
```

---

## 6. Common Issues & Solutions

### **Issue: Authentication Failed**
```
Error: Shiprocket authentication failed
```

**Solution:**
- Verify email and password in database
- Check if Shiprocket account is active
- Ensure API access is enabled in Shiprocket dashboard

---

### **Issue: Shipment Creation Failed**
```
Error: Failed to create shipment
```

**Solutions:**
- Check if order status is "Packed"
- Verify shipping address is complete
- Ensure pincode is serviceable
- Check courier account balance
- Review courier API logs

---

### **Issue: Webhooks Not Working**
```
Webhooks not being received
```

**Solutions:**
- Verify webhook URL is publicly accessible
- Check webhook signature validation
- Review courier dashboard for webhook delivery logs
- Test webhook endpoint manually with sample payload

---

## 7. Testing Webhooks Locally

Use ngrok to test webhooks in development:

```bash
# Start ngrok
ngrok http 4000

# Use ngrok URL in webhook configuration
https://abc123.ngrok.io/api/v1/courier/webhook/Shiprocket
```

---

## 8. Courier Partner Comparison

| Feature | Shiprocket | Delhivery | Shadowfax |
|---------|------------|-----------|-----------|
| API Complexity | Medium | High | Low |
| Documentation | Good | Excellent | Average |
| Coverage | Pan-India | Pan-India | Metro Cities |
| COD Support | Yes | Yes | Yes |
| International | Yes | Yes | No |
| Same Day | Partner-dependent | Yes | Yes |
| Rate Card | Dynamic | Fixed + Dynamic | Fixed |

---

## 9. Performance Optimization

### **Caching Strategy:**
```javascript
// Cache rate quotes for 1 hour
const cacheKey = `rates:${pickupPin}:${deliveryPin}:${weight}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const rates = await courierManager.getAllRates(...);
await redis.setex(cacheKey, 3600, JSON.stringify(rates));
```

### **Batch Operations:**
```javascript
// Create multiple shipments in parallel
const shipments = await Promise.all(
  orders.map(order => 
    courierManager.createShipment(courierName, shipmentData, order._id)
  )
);
```

---

## 10. Support & Resources

### **Official Documentation:**
- Shiprocket: https://apidocs.shiprocket.in/
- Delhivery: https://developers.delhivery.com/
- Shadowfax: Contact account manager

### **Community:**
- GitHub Issues: [Your Repo URL]
- Discord: [Your Discord URL]

### **Emergency Contacts:**
- Shiprocket Support: support@shiprocket.com
- System Admin: [Your Email]

---

✅ **You're all set!** The courier integration is ready to handle thousands of shipments per day.

Last Updated: 2026-02-01
