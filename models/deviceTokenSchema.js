import mongoose from "mongoose";

const deviceTokenSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",
    required: true
  },
  token: { 
    type: String, 
    required: true,
    unique: true // A token should belong to one entry
  },
  platform: { 
    type: String, 
    enum: ["android", "ios", "web"],
    default: "android"
  },
  lastActive: { 
    type: Date, 
    default: Date.now 
  }
});

export const DeviceToken = mongoose.model("DeviceToken", deviceTokenSchema);
