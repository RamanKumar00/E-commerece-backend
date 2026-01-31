import mongoose from "mongoose";

const uri = "mongodb+srv://amanenterprises:R%40man9835@cluster0.in9dty1.mongodb.net/amanenterprises?retryWrites=true&w=majority&appName=Cluster0";

console.log("Attempting to connect...");
mongoose.connect(uri)
  .then(() => {
    console.log("SUCCESS: Connected to database!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("FAILURE: Could not connect.");
    console.error(err);
    process.exit(1);
  });
