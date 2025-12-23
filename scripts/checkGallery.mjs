import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Gallery from '../models/Gallery.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main(){
  try{
    const uri = process.env.MONGO_URI;
    if(!uri){
      console.error('MONGO_URI not set in .env');
      process.exit(2);
    }

    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB');

    const items = await Gallery.find().sort({ createdAt: -1 }).lean();
    console.log(`Gallery documents found: ${items.length}`);
    items.forEach(it => console.log(JSON.stringify(it)));
    await mongoose.disconnect();
    process.exit(0);
  }catch(err){
    console.error('Error querying Gallery:', err);
    process.exit(1);
  }
}

main();
