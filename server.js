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
let cloudinary;
let streamifier;
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

// Cloudinary will be configured dynamically below if available and configured

// Basic environment validation to avoid runtime crashes
const requiredEnvs = ['MONGO_URI'];
const missing = requiredEnvs.filter((k) => !process.env[k]);
if (missing.length) {
  console.warn('Missing required env vars:', missing.join(', '));
}

let USE_CLOUDINARY = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
if (!USE_CLOUDINARY) console.warn('Cloudinary not fully configured — uploads will be stored locally');

// Dynamically import cloudinary and streamifier only when needed to avoid import errors
if (USE_CLOUDINARY) {
  try {
    const mod = await import('cloudinary');
    cloudinary = mod.v2 || mod.default?.v2 || mod;
    const s = await import('streamifier');
    streamifier = s.default || s;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  } catch (err) {
    console.warn('Cloudinary modules not available in this environment:', err?.message || err);
    USE_CLOUDINARY = false;
  }
}

// Global error handlers to log uncaught errors (prevents silent crashes)
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

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
let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    console.log("✅ Using existing MongoDB connection");
    return;
  }

  try {
    const db = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    isConnected = db.connections[0].readyState === 1;
    console.log("✅ Connected to MongoDB Atlas");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    throw err;
  }
};

// Initialize connection
connectDB().catch(console.error);

//----------------------------------------------------
// MIDDLEWARE
//----------------------------------------------------
// Configure CORS: allow the configured frontend URL, and during development
// also allow any localhost dev port (helps when Vite picks a different port).
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // allow non-browser requests (curl, server-side)
      if (origin === frontendUrl) return callback(null, true);
      // allow localhost with any port during development
      if (process.env.NODE_ENV !== 'production' && /https?:\/\/localhost:\d+/.test(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json());

// Static files - use /tmp in production
const uploadsPath = process.env.NODE_ENV === "production" 
  ? "/tmp/uploads/gallery" 
  : path.join(__dirname, "uploads/gallery");
app.use("/uploads/gallery", express.static(uploadsPath));

// Ensure DB connection before handling requests
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("Database connection error:", err);
    res.status(503).json({ error: "Database connection failed" });
  }
});

//----------------------------------------------------
// HEALTH CHECK
//----------------------------------------------------
app.get("/", (req, res) => res.send("🌍 RSYI Server is running 🚀"));

//----------------------------------------------------
// GALLERY ENDPOINTS
//----------------------------------------------------
// Use /tmp for Vercel serverless (writable directory)
const galleryDir = process.env.NODE_ENV === "production" 
  ? "/tmp/uploads/gallery" 
  : path.join(__dirname, "uploads/gallery");

if (!fs.existsSync(galleryDir)) fs.mkdirSync(galleryDir, { recursive: true });

// Configure multer storage: use memory when uploading to Cloudinary, otherwise disk
const upload = USE_CLOUDINARY
  ? multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } })
  : multer({ storage: multer.diskStorage({ destination: galleryDir, filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname) }), limits: { fileSize: 100 * 1024 * 1024 } });

app.post('/api/admin/gallery/upload', upload.single('media'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const resourceType = req.file.mimetype && req.file.mimetype.startsWith('video') ? 'video' : 'image';

    if (USE_CLOUDINARY) {
      // upload via memory stream to Cloudinary
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream({ folder: 'gallery', resource_type: resourceType }, (error, result) => {
          if (error) return reject(error);
          resolve(result);
        });
        streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
      });

      const item = new Gallery({
        title: req.body.title,
        caption: req.body.caption,
        mediaUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        mediaType: resourceType,
      });
      await item.save();
      return res.status(201).json(item);
    }

    // Fallback: save file locally and serve via /uploads/gallery
    const filename = req.file.filename || (Date.now() + '-' + req.file.originalname);
    const localUrl = `/uploads/gallery/${filename}`;
    const item = new Gallery({
      title: req.body.title,
      caption: req.body.caption,
      mediaUrl: localUrl,
      mediaType: resourceType,
    });
    await item.save();
    return res.status(201).json(item);
  } catch (err) {
    console.error('❌ Upload failed:', err);
    return res.status(500).json({ message: 'Upload failed', error: err?.message });
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
    // If item was uploaded to Cloudinary, remove it there
    if (item.publicId) {
      try {
        await cloudinary.uploader.destroy(item.publicId, { resource_type: item.mediaType === 'video' ? 'video' : 'image' });
      } catch (err) {
        console.error('Cloudinary delete failed:', err);
      }
    } else {
      // fallback: delete local file
      const filePath = path.join(__dirname, item.mediaUrl.replace(/^\//, ""));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

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

// APPROVE BOOKING - sets status and notifies user
app.put("/api/admin/bookings/:id/approve", async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status: "approved", updatedAt: Date.now() },
      { new: true }
    );
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    // send approval email
    await transporter.sendMail({
      from: `"Reliance Soul Studio" <${process.env.GMAIL_USER}>`,
      to: booking.email,
      subject: "Booking Approved — Reliance Soul Studio",
      text: `Hi ${booking.name},\n\nYour booking for ${booking.category} on ${booking.date} at ${booking.time} has been approved. We look forward to seeing you.\n\nIf you need to reschedule, reply to this email and our team will assist you.\n\n— Reliance Soul Team`,
    });

    res.json({ success: true, booking });
  } catch (err) {
    console.error("❌ Approve booking failed:", err);
    res.status(500).json({ message: "Failed to approve booking" });
  }
});

// REJECT BOOKING - sets status and notifies user
app.put("/api/admin/bookings/:id/reject", async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", updatedAt: Date.now() },
      { new: true }
    );
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    // send rejection / contact email
    await transporter.sendMail({
      from: `"Reliance Soul Studio" <${process.env.GMAIL_USER}>`,
      to: booking.email,
      subject: "Booking Update — Reliance Soul Studio",
      text: `Hi ${booking.name},\n\nThank you for your booking request for ${booking.category} on ${booking.date} at ${booking.time}. At this time our team cannot confirm your requested slot. We will contact you shortly to help reschedule.\n\nIf you prefer, reply to this email and our team will reach out to you.\n\n— Reliance Soul Team`,
    });

    res.json({ success: true, booking });
  } catch (err) {
    console.error("❌ Reject booking failed:", err);
    res.status(500).json({ message: "Failed to reject booking" });
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
