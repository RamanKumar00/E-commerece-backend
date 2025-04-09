import mongoose, { mongo } from "mongoose";

const bannerSchema = new mongoose.Schema({
  bannerImage: {
    public_id: String,
    url: String,
  },
});

export const Banner = mongoose.model("Banner", bannerSchema);
