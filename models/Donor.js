// models/Donor.js
import mongoose from "mongoose";

const donorSchema = new mongoose.Schema(
  {
    name: { type: String },
    email: { type: String },
    contact: { type: String }, // WhatsApp or email for manual donors
    amount: { type: Number, default: 0 }, // in USD
    paymentMethod: { type: String, enum: ["stripe", "manual"], default: "stripe" },
  },
  { timestamps: true }
);

export default mongoose.model("Donor", donorSchema);
