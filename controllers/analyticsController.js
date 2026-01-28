import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import { Order } from "../models/orderSchema.js";
import { User } from "../models/userSchema.js";
import { Product } from "../models/productSchema.js";

export const getDashboardStats = catchAsyncErrors(async (req, res, next) => {
  // 1. Total Stats
  const totalOrders = await Order.countDocuments();
  const totalUsers = await User.countDocuments();
  const totalProducts = await Product.countDocuments();

  // 2. Total Revenue (Aggregate)
  const revenueData = await Order.aggregate([
    { $match: { orderStatus: { $ne: "Cancelled" } } },
    { $group: { _id: null, total: { $sum: "$pricing.totalPrice" } } }
  ]);
  const totalRevenue = revenueData.length > 0 ? revenueData[0].total : 0;

  // 3. Recent Orders
  const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(5).populate("user", "name");

  // 4. Order Status Distribution
  const statusDist = await Order.aggregate([
      { $group: { _id: "$orderStatus", count: { $sum: 1 } } }
  ]);

  res.status(200).json({
    success: true,
    stats: {
        totalOrders,
        totalUsers,
        totalProducts,
        totalRevenue: Math.round(totalRevenue),
        orderStatusDistribution: statusDist
    },
    recentOrders
  });
});
