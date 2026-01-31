import admin from "firebase-admin";
import { User } from "../models/userSchema.js";

let firebaseInitialized = false;

try {
  // Use environment variable for service account if available
  // It is safer to parse JSON string from env var
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    firebaseInitialized = true;
    console.log("Firebase Admin Initialized via FIREBASE_SERVICE_ACCOUNT");
  } else {
    // Fallback to default application credentials (good for cloud deployment)
    // Or it might fail locally without setup.
    // We safeguard with try-catch.
    admin.initializeApp();
    firebaseInitialized = true;
    console.log("Firebase Admin Initialized with Default Credentials");
  }
} catch (error) {
  console.warn("Firebase Admin Initialization Failed. Notifications will not be sent.", error.message);
}

export const sendNotificationToAdmins = async (title, body, data = {}) => {
  if (!firebaseInitialized) {
    console.warn("Cannot send notification: Firebase not initialized.");
    return;
  }

  try {
    // 1. Find all admins
    const admins = await User.find({ role: "Admin" });
    
    // 2. Collate Valid tokens
    const tokens = admins.reduce((acc, admin) => {
        if (admin.fcmTokens && Array.isArray(admin.fcmTokens)) {
            // Filter out empty tokens
            const validTokens = admin.fcmTokens.filter(t => t && t.length > 10);
            acc.push(...validTokens);
        }
        return acc;
    }, []);

    // Remove duplicates
    const uniqueTokens = [...new Set(tokens)];

    if (uniqueTokens.length === 0) {
      console.log("No Admin tokens found to send notification.");
      return;
    }

    // 3. Construct Message
    // Note: Multicast message structure
    const message = {
      notification: {
        title,
        body,
      },
      data,
      tokens: uniqueTokens,
    };

    // 4. Send
    // Use messaging().sendEachForMulticast() as best practice
    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(`${response.successCount} messages were sent successfully out of ${uniqueTokens.length}`);

    // Optional: Clean up failed tokens
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(uniqueTokens[idx]);
        }
      });
      // Removing failed tokens from DB is complex here as we aggregated them.
      // We skip cleanup for now to avoid accidental removal of other Admin's tokens if shared? 
      // Tokens are unique per device.
      // We could iterate admins and pull failed tokens.
    }

  } catch (error) {
    console.error("Error sending notification:", error);
  }
};
