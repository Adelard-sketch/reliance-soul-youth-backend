//----------------------------------------------------
// IMPORTS
//----------------------------------------------------
import express from "express";
import cors from "cors";
import Stripe from "stripe";
import nodemailer from "nodemailer";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";

import Booking from "./models/Booking.js";
import Contact from "./models/Contact.js";
import Donor from "./models/Donor.js";
import Gallery from "./models/Gallery.js";

//----------------------------------------------------
// ENV SETUP
//----------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

//----------------------------------------------------
// APP & STRIPE CONFIG
//----------------------------------------------------
const app = express();
const PORT = process.env.PORT || 5000;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });
const MANAGER_EMAIL = process.env.MANAGER_EMAIL || process.env.GMAIL_USER;

//----------------------------------------------------
// EMAIL SETUP
//----------------------------------------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

//----------------------------------------------------
// DATABASE CONNECTION
//----------------------------------------------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  });

//----------------------------------------------------
// MIDDLEWARE
//----------------------------------------------------
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use("/uploads/gallery", express.static(path.join(__dirname, "uploads/gallery")));

//----------------------------------------------------
// HEALTH CHECK
//----------------------------------------------------
app.get("/", (req, res) => res.send("🌍 RSYI Server is running 🚀"));

//----------------------------------------------------
// GALLERY ENDPOINTS
//----------------------------------------------------
const galleryDir = path.join(__dirname, "uploads/gallery");
if (!fs.existsSync(galleryDir)) fs.mkdirSync(galleryDir, { recursive: true });

const storage = multer.diskStorage({
  destination: galleryDir,
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
});

app.post("/api/admin/gallery/upload", upload.single("media"), async (req, res) => {
  try {
    const mediaType = req.file.mimetype.startsWith("video") ? "video" : "image";
    const item = new Gallery({
      title: req.body.title,
      caption: req.body.caption,
      mediaUrl: `/uploads/gallery/${req.file.filename}`,
      mediaType,
    });
    await item.save();
    res.status(201).json(item);
  } catch (err) {
    console.error("❌ Upload failed:", err);
    res.status(500).json({ message: "Upload failed" });
  }
});

app.get("/api/admin/gallery", async (_, res) => {
  const items = await Gallery.find().sort({ createdAt: -1 });
  res.json(items);
});

app.delete("/api/admin/gallery/:id", async (req, res) => {
  try {
    const item = await Gallery.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Not found" });

    const filePath = path.join(__dirname, item.mediaUrl.replace(/^\//, ""));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await item.deleteOne();
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Delete failed:", err);
    res.status(500).json({ message: "Failed to delete" });
  }
});

//----------------------------------------------------
// ADMIN LOGIN
//----------------------------------------------------
app.post("/api/admin/login", (req, res) => {
  const { email, password } = req.body;
  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD)
    res.json({ success: true, token: "secure-admin-token" });
  else res.status(401).json({ success: false, message: "Invalid credentials." });
});

//----------------------------------------------------
// ADMIN DATA ENDPOINTS
//----------------------------------------------------
app.get("/api/admin/bookings", async (_, res) =>
  res.json(await Booking.find().sort({ createdAt: -1 }))
);
app.get("/api/admin/contacts", async (_, res) =>
  res.json(await Contact.find().sort({ createdAt: -1 }))
);
app.get("/api/admin/donors", async (_, res) =>
  res.json(await Donor.find().sort({ createdAt: -1 }))
);

//----------------------------------------------------
// DELETE BOOKING
//----------------------------------------------------
app.delete("/api/admin/bookings/:id", async (req, res) => {
  try {
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Delete booking failed:", err);
    res.status(500).json({ message: "Failed to delete booking" });
  }
});

//----------------------------------------------------
// BOOKING ENDPOINT
//----------------------------------------------------
app.post("/api/book", async (req, res) => {
  try {
    const booking = new Booking(req.body);
    await booking.save();

    await transporter.sendMail({
      from: `"Reliance Soul Studio" <${process.env.GMAIL_USER}>`,
      to: req.body.email,
      subject: "Booking Confirmation — Reliance Soul Studio",
      text: `Hi ${req.body.name}, your booking for ${req.body.category} on ${req.body.date} at ${req.body.time} has been confirmed.`,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Booking error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

//----------------------------------------------------
// DONATION ENDPOINT
//----------------------------------------------------
app.post("/api/donate", async (req, res) => {
  try {
    const { amount, email, donorEmail } = req.body;
    const finalEmail = email || donorEmail;

    if (!amount || !finalEmail)
      return res.status(400).json({ error: "Missing amount or email" });

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0)
      return res.status(400).json({ error: "Invalid donation amount" });

    const unitAmount = Math.round(numericAmount * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Reliance Soul International Youth Foundation Donation" },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      customer_email: finalEmail,
      success_url: `${process.env.FRONTEND_URL}/donate?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/donate?canceled=true`,
    });

    const donor = new Donor({
      email: finalEmail,
      amount: numericAmount,
      paymentMethod: "stripe",
    });
    await donor.save();

    res.json({ url: session.url });
  } catch (err) {
    console.error("❌ Stripe Donation Error:", err);
    res.status(500).json({ error: "Failed to create donation session" });
  }
});

//----------------------------------------------------
// CONTACT ENDPOINT
//----------------------------------------------------
app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message)
      return res.status(400).json({ success: false, message: "All fields are required." });

    const newContact = new Contact({ name, email, subject, message });
    await newContact.save();

    await transporter.sendMail({
      from: `"RSYI Website" <${process.env.GMAIL_USER}>`,
      to: MANAGER_EMAIL,
      subject: `📩 New Contact Message from ${name}`,
      text: `
You received a new contact message through the RSYI website.

Name: ${name}
Email: ${email}
Subject: ${subject || "N/A"}

Message:
${message}
      `,
    });

    res.json({ success: true, message: "Message sent successfully!" });
  } catch (err) {
    console.error("❌ Contact form error:", err);
    res.status(500).json({ success: false, message: "Server error. Please try again later." });
  }
});

//----------------------------------------------------
// START SERVER (LOCAL) / EXPORT FOR VERCEL
//----------------------------------------------------
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, "0.0.0.0", () =>
    console.log(`✅ RSYI Server running on port ${PORT}`)
  );
}

// Export for Vercel serverless
export default app;
