import mongoose from 'mongoose';
import { CourierPartner } from '../models/courierPartnerSchema.js';
import { config } from 'dotenv';

// Load environment variables
if (!process.env.MONGO_URI) {
  config({ path: './config/config.env' });
}

async function setupCourierPartners() {
  try {
    console.log('🚀 Starting courier partner setup...');

    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to database');

    // Check if courier partners already exist
    const existing = await CourierPartner.find();
    if (existing.length > 0) {
      console.log('⚠️  Courier partners already exist. Skipping setup.');
      console.log(`Found ${existing.length} existing partner(s):`, existing.map(p => p.name).join(', '));
      process.exit(0);
    }

    // Create Shiprocket configuration
    const shiprocket = await CourierPartner.create({
      name: "Shiprocket",
      displayName: "Shiprocket",
      apiBaseUrl: "https://apiv2.shiprocket.in/v1/external",
      credentials: {
        email: process.env.SHIPROCKET_EMAIL || "your-email@example.com",
        password: process.env.SHIPROCKET_PASSWORD || "your-password",
        apiKey: null,
        apiSecret: null,
        token: null,
        tokenExpiry: null,
      },
      isActive: true,
      supportedServices: ["Standard", "Express", "Surface", "Air"],
      configuration: {
        webhookUrl: process.env.BACKEND_URL 
          ? `${process.env.BACKEND_URL}/api/v1/courier/webhook/Shiprocket`
          : "https://your-domain.com/api/v1/courier/webhook/Shiprocket",
        webhookSecret: process.env.SHIPROCKET_WEBHOOK_SECRET || "generate-random-secret",
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

    console.log('✅ Created Shiprocket partner');

    // Create Manual courier option (fallback)
    const manual = await CourierPartner.create({
      name: "Manual",
      displayName: "Manual Entry",
      apiBaseUrl: null,
      credentials: {
        apiKey: null,
        apiSecret: null,
        token: null,
        tokenExpiry: null,
      },
      isActive: true,
      supportedServices: ["Standard"],
      configuration: {
        webhookUrl: null,
        webhookSecret: null,
        allowedIPs: [],
        maxRetries: 1,
        timeoutSeconds: 30,
      },
      performance: {
        totalShipments: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        rtoCount: 0,
        averageDeliveryDays: 5,
        onTimeDeliveryRate: 85,
        lastUpdated: new Date(),
      },
      pricing: {
        baseFee: 50,
        perKgRate: 25,
        codCharges: 30,
        rtoCharges: 60,
      },
    });

    console.log('✅ Created Manual courier option');

    console.log('\n📦 Courier Partner Setup Complete!');
    console.log('==========================================');
    console.log('Created partners:');
    console.log(`  1. ${shiprocket.name} (${shiprocket.isActive ? 'Active' : 'Inactive'})`);
    console.log(`  2. ${manual.name} (${manual.isActive ? 'Active' : 'Inactive'})`);
    console.log('==========================================\n');

    console.log('📝 Next Steps:');
    console.log('  1. Update Shiprocket credentials in .env file:');
    console.log('     SHIPROCKET_EMAIL=your-email@example.com');
    console.log('     SHIPROCKET_PASSWORD=your-password');
    console.log('     SHIPROCKET_WEBHOOK_SECRET=random-secret-string');
    console.log('');
    console.log('  2. Configure webhook in Shiprocket dashboard:');
    console.log(`     URL: ${shiprocket.configuration.webhookUrl}`);
    console.log('');
    console.log('  3. Test the integration:');
    console.log('     curl -X POST http://localhost:4000/api/v1/courier/check-service \\');
    console.log('       -H "Content-Type: application/json" \\');
    console.log('       -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \\');
    console.log('       -d \'{"pickupPincode": "110001", "deliveryPincode": "400001", "cod": false}\'');
    console.log('');

    await mongoose.disconnect();
    console.log('✅ Disconnected from database');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up courier partners:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run setup
setupCourierPartners();
