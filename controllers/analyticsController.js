import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import { Order } from "../models/orderSchema.js";
import { User } from "../models/userSchema.js";
import { Product } from "../models/productSchema.js";

export const getDashboardStats = catchAsyncErrors(async (req, res, next) => {
  // 1. Total Stats
  const totalOrders = await Order.countDocuments();
  const totalUsers = await User.countDocuments();
  const totalProducts = await Product.countDocuments();

  // 2. Revenue Calculations
  // Helper for Start of Day
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // Helper for Start of Week (Sunday)
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  // Helper for Start of Month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Aggregation for different time periods
  const revenueStats = await Order.aggregate([
    { $match: { orderStatus: { $ne: "Cancelled" } } },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$pricing.totalPrice" },
        todayRevenue: {
          $sum: {
            $cond: [{ $gte: ["$createdAt", startOfDay] }, "$pricing.totalPrice", 0]
          }
        },
        weeklyRevenue: {
          $sum: {
            $cond: [{ $gte: ["$createdAt", startOfWeek] }, "$pricing.totalPrice", 0]
          }
        },
        monthlyRevenue: {
          $sum: {
            $cond: [{ $gte: ["$createdAt", startOfMonth] }, "$pricing.totalPrice", 0]
          }
        },
        todayOrders: {
            $sum: {
                $cond: [{ $gte: ["$createdAt", startOfDay] }, 1, 0]
            }
        }
      }
    }
  ]);

  const statsData = revenueStats[0] || { totalRevenue: 0, todayRevenue: 0, weeklyRevenue: 0, monthlyRevenue: 0, todayOrders: 0 };

  // 3. Recent Orders
  const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(5).populate("user", "name");

  // 4. Order Status Distribution
  const statusDist = await Order.aggregate([
      { $group: { _id: "$orderStatus", count: { $sum: 1 } } }
  ]);

  // 5. Top Selling Products
  const topProducts = await Order.aggregate([
    { $unwind: "$orderItems" },
    { $group: { _id: "$orderItems.name", sold: { $sum: "$orderItems.quantity" } } },
    { $sort: { sold: -1 } },
    { $limit: 5 }
  ]);

  res.status(200).json({
    success: true,
    stats: {
        totalOrders,
        totalUsers,
        totalProducts,
        totalRevenue: Math.round(statsData.totalRevenue),
        todayRevenue: Math.round(statsData.todayRevenue),
        weeklyRevenue: Math.round(statsData.weeklyRevenue),
        monthlyRevenue: Math.round(statsData.monthlyRevenue),
        todayOrders: statsData.todayOrders,
        orderStatusDistribution: statusDist,
        topProducts
    },
    recentOrders
  });
});
