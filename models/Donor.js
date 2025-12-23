// models/Donor.js
import mongoose from "mongoose";

const donorSchema = new mongoose.Schema(
  {
    name: { type: String },
    email: { type: String },
    contact: { type: String }, 
    amount: { type: Number, default: 0 }, 
    paymentMethod: { type: String, enum: ["stripe", "manual"], default: "stripe" },
  },
  { timestamps: true }
);

export default mongoose.model("Donor", donorSchema);
