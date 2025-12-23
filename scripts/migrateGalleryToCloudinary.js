#!/usr/bin/env node
/*
  Migration script: find local gallery files and upload them to Cloudinary,
  then update the Gallery.mediaUrl field with the returned secure_url.

  Usage:
    cd backend
    node scripts/migrateGalleryToCloudinary.js

  Requirements (set in env or .env):
    MONGO_URI, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

  The script searches common local paths for files referenced as
  "/uploads/gallery/<filename>" and will skip items it cannot find.
*/

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const Gallery = (await import('../models/Gallery.js')).default;

const DB = process.env.MONGO_URI;
if (!DB) {
  console.error('Missing MONGO_URI in env');
  process.exit(1);
}

const possibleDirs = [
  path.join(process.cwd(), 'uploads', 'gallery'),
  path.join(process.cwd(), 'Server', 'uploads', 'gallery'),
  path.join(process.cwd(), 'Server', 'uploads'),
  path.join(process.cwd(), '..', 'Server', 'uploads', 'gallery'),
  path.join(process.cwd(), '..', 'uploads', 'gallery'),
  path.join(process.cwd(), 'frontend', 'dist', 'assets'),
];

const findLocalFile = (filename) => {
  for (const dir of possibleDirs) {
    const p = path.join(dir, filename);
    if (fs.existsSync(p)) return p;
  }
  return null;
};

const run = async () => {
  await mongoose.connect(DB, { serverSelectionTimeoutMS: 5000 });
  console.log('Connected to DB');

  const items = await Gallery.find({ mediaUrl: { $regex: '^/uploads/gallery/' } });
  console.log(`Found ${items.length} gallery items with local mediaUrl`);

  for (const item of items) {
    try {
      const urlPath = item.mediaUrl; // e.g. /uploads/gallery/1234-name.jpg
      const filename = urlPath.split('/').pop();
      const localPath = findLocalFile(filename);
      if (!localPath) {
        console.warn(`Local file not found for ${filename}; skipping (id=${item._id})`);
        continue;
      }

      console.log(`Uploading ${localPath} to Cloudinary...`);
      const res = await cloudinary.uploader.upload(localPath, { folder: 'gallery' });
      if (!res || !res.secure_url) {
        console.error(`Cloudinary upload failed for ${localPath}`);
        continue;
      }

      item.mediaUrl = res.secure_url;
      await item.save();
      console.log(`Updated item ${item._id} -> ${res.secure_url}`);
    } catch (err) {
      console.error('Error processing item', item._id, err.message || err);
    }
  }

  await mongoose.disconnect();
  console.log('Done');
};

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
