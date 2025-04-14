import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  categoryName: {
    type: String,
    require: true,
  },
  categoryImage: {
    public_id: String,
    url: String,
  },
});

export const Category = mongoose.model("Category", categorySchema);
