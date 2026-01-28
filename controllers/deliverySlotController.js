import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import { DeliverySlot } from "../models/deliverySlotSchema.js";
import ErrorHandler from "../middlewares/error.js";

// Get available slots for next 7 days
export const getDeliverySlots = catchAsyncErrors(async (req, res, next) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  const slots = await DeliverySlot.find({
    date: { $gte: today, $lt: nextWeek },
    isActive: true
  }).sort({ date: 1, timeSlot: 1 });

  // Filter out slots that are full or in the past (time-wise)
  const availableSlots = slots.filter(slot => {
      // Logic to filter past time slots if date is today
      // For simplicity, just check bookedCount
      return slot.bookedCount < slot.capacity;
  });

  // Group by Date
  const groupedSlots = {};
  availableSlots.forEach(slot => {
    const dateStr = slot.date.toISOString().split('T')[0];
    if (!groupedSlots[dateStr]) groupedSlots[dateStr] = [];
    groupedSlots[dateStr].push(slot);
  });

  res.status(200).json({
    success: true,
    slots: groupedSlots
  });
});

// Create Slots (Admin)
export const createDeliverySlots = catchAsyncErrors(async (req, res, next) => {
  const { startDate, days, timeSlots, capacity } = req.body;
  // startDate: "2024-01-30", days: 7, timeSlots: ["10-12", "14-16"], capacity: 20

  const start = new Date(startDate);
  let createdCount = 0;

  for (let i = 0; i < days; i++) {
    const currentDate = new Date(start);
    currentDate.setDate(start.getDate() + i);
    currentDate.setHours(0,0,0,0);

    for (const time of timeSlots) {
      // Check if exists
      const exists = await DeliverySlot.findOne({ date: currentDate, timeSlot: time });
      if (!exists) {
        await DeliverySlot.create({
          date: currentDate,
          timeSlot: time,
          capacity: capacity || 20
        });
        createdCount++;
      }
    }
  }

  res.status(201).json({
    success: true,
    message: `${createdCount} delivery slots created.`
  });
});
