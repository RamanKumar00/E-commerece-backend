import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import { Notification } from "../models/notificationSchema.js";
import { DeviceToken } from "../models/deviceTokenSchema.js";
import ErrorHandler from "../middlewares/error.js";

// Register Device Token
export const registerDevice = catchAsyncErrors(async (req, res, next) => {
  const { token, platform } = req.body;
  if (!token) return next(new ErrorHandler("Token required", 400));

  let device = await DeviceToken.findOne({ token });
  if (device) {
    device.user = req.user._id;
    device.lastActive = Date.now();
    await device.save();
  } else {
    await DeviceToken.create({
      user: req.user._id,
      token,
      platform
    });
  }

  res.status(200).json({ success: true, message: "Device registered" });
});

// Get My Notifications
export const getMyNotifications = catchAsyncErrors(async (req, res, next) => {
  const notifications = await Notification.find({ user: req.user._id })
                                          .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    notifications
  });
});

// Mark as Read
export const markNotificationsRead = catchAsyncErrors(async (req, res, next) => {
    await Notification.updateMany(
        { user: req.user._id, isRead: false },
        { isRead: true }
    );
    res.status(200).json({ success: true, message: "Marked all as read" });
});

// Send Notification (Admin or Internal)
// This is a helper function, but we can expose an API for Admin to blast offers
export const sendPushNotification = async (userId, title, message, metadata) => {
    // 1. Create Notification Record
    await Notification.create({
        user: userId,
        title,
        message,
        metadata
    });

    // 2. Fetch Tokens
    const tokens = await DeviceToken.find({ user: userId });
    
    // 3. Send to FCM (Mocked for now)
    if (tokens.length > 0) {
        console.log(`[FCM-MOCK] Sending to ${tokens.length} devices for User ${userId}: ${title}`);
    }
};

export const broadcastNotification = catchAsyncErrors(async (req, res, next) => {
    const { title, message } = req.body;
    // Implementation to send to all users
    // This receives Admin calls
    res.status(200).json({ success: true, message: "Broadcast initiated (mock)" });
});
