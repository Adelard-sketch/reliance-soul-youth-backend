import PDFDocument from 'pdfkit';
import fs from 'fs';

const outPath = './RSYI_Presentation.pdf';
const doc = new PDFDocument({ autoFirstPage: false });
const stream = fs.createWriteStream(outPath);
doc.pipe(stream);

function addTitle(title, subtitle) {
  doc.addPage({ size: 'A4', margin: 50 });
  doc.fontSize(20).fillColor('#0b3d91').text(title, { align: 'center' });
  if (subtitle) {
    doc.moveDown(0.5).fontSize(12).fillColor('#333').text(subtitle, { align: 'center' });
  }
  doc.moveDown(1);
}

function addSectionHeading(text) {
  doc.moveDown(0.5).fontSize(14).fillColor('#0b3d91').text(text);
  doc.moveDown(0.2);
}

function addParagraph(text) {
  doc.fontSize(11).fillColor('#222').text(text, { align: 'left', paragraphGap: 6 });
}

function drawArchitectureDiagram() {
  // simple boxes and lines representing 3-tier architecture
  doc.addPage({ size: 'A4', margin: 50 });
  doc.fontSize(16).fillColor('#0b3d91').text('3-Tier Architecture', { align: 'center' });
  const topY = 120;
  const centerX = 297;

  // Presentation Tier (Frontend)
  doc.rect(centerX - 180, topY, 140, 60).fillAndStroke('#dbe9ff', '#0b3d91');
  doc.fillColor('#0b3d91').fontSize(12).text('Presentation\n(Frontend)', centerX - 180 + 10, topY + 12);

  // Application Tier (Backend API)
  doc.rect(centerX - 70, topY + 120, 140, 60).fillAndStroke('#dbe9ff', '#0b3d91');
  doc.fillColor('#0b3d91').text('Application\n(Backend API)', centerX - 70 + 16, topY + 142);

  // Data Tier (Database / Cloudinary)
  doc.rect(centerX + 100, topY + 240, 170, 60).fillAndStroke('#dbe9ff', '#0b3d91');
  doc.fillColor('#0b3d91').text('Data Tier\n(MongoDB Atlas, Cloudinary)', centerX + 110, topY + 262);

  // arrows
  doc.moveTo(centerX - 110, topY + 80).lineTo(centerX - 5, topY + 120).stroke('#0b3d91');
  doc.moveTo(centerX + 70, topY + 180).lineTo(centerX + 120, topY + 240).stroke('#0b3d91');

  doc.moveDown(6);
}

function addTechAndAPIs() {
  doc.addPage({ size: 'A4', margin: 50 });
  addSectionHeading('Technologies Used');
  addParagraph('- Frontend: React, Vite, Tailwind CSS, React Router (HashRouter)');
  addParagraph('- Backend: Node.js (ESM), Express, Mongoose');
  addParagraph('- Authentication / Deploy: Vercel (serverless), protected deployments');
  addParagraph('- Media Storage: Cloudinary (persistent uploads)');
  addParagraph('- Payments / Email: Stripe, Nodemailer');
  addParagraph('- File Uploads: multer, streamifier (Cloudinary streaming)');

  addSectionHeading('APIs and Endpoints');
  addParagraph('- GET /            → Health check');
  addParagraph('- POST /api/admin/gallery/upload → Upload media (multipart form, field `media`)');
  addParagraph('- GET  /api/admin/gallery → List gallery items');
  addParagraph('- DELETE /api/admin/gallery/:id → Delete media (Cloudinary or local fallback)');
  addParagraph('- POST /api/book → Booking');
  addParagraph('- POST /api/donate → Create Stripe checkout session');
}

function addDatabaseSchema() {
  doc.addPage({ size: 'A4', margin: 50 });
  addSectionHeading('Database (MongoDB) & Models');
  addParagraph('Primary collections:');
  addParagraph('- Gallery: { title, caption, mediaUrl, publicId, mediaType, createdAt }');
  addParagraph('- Booking, Contact, Donor: standard CRM-like documents');
  addParagraph('\nDesign notes: the backend stores Cloudinary `secure_url` and `public_id` so media can be reliably served and removed.');
}

function addNarrative() {
  doc.addPage({ size: 'A4', margin: 50 });
  addSectionHeading('Project Narrative');
  addParagraph('Reliance Soul Youth Initiative (RSYI) is a small full-stack site for a youth foundation. The project allows admins to upload media to a gallery, accept bookings, and collect donations.');
  addParagraph('Originally deployed to serverless hosting, media were stored on ephemeral local storage which caused images to vanish. The project was updated to stream uploads to Cloudinary and save the `secure_url` and `public_id` on the Gallery model. The frontend was modified to use Hash-based routing and relative asset bases so it can be served from shared hosting without server rewrites.');
}

function addVideoScriptAndStoryboard() {
  doc.addPage({ size: 'A4', margin: 50 });
  addSectionHeading('6-minute Video Script (Structure)');
  addParagraph('Total duration: 6:00 minutes = 360 seconds. Use ~12 slides at ~30s each. Speaker voice: clear, friendly, 120-150 wpm.');

  const slides = [
    { title: 'Title & Intro', notes: 'Introduce RSYI and the demo goals (15s). Quick agenda (15s).' },
    { title: 'Problem Statement', notes: 'Explain earlier issue: ephemeral storage for media on serverless; images disappear.' },
    { title: 'Solution Overview', notes: 'Introduce Cloudinary, migration, and frontend changes.' },
    { title: '3-Tier Architecture', notes: 'Explain Presentation, Application, Data tiers and responsibilities.' },
    { title: 'Frontend Details', notes: 'React+Vite, HashRouter, build pipeline, static hosting.' },
    { title: 'Backend Details', notes: 'Express, endpoints, multer memory storage, Cloudinary streaming.' },
    { title: 'Media Flow', notes: 'Show upload flow diagram: client -> backend -> Cloudinary -> DB saved URL.' },
    { title: 'Migration', notes: 'Overview of migration script for existing local files to Cloudinary.' },
    { title: 'APIs & Security', notes: 'List endpoints, env vars, Vercel protection and bypass token for testing.' },
    { title: 'Demo Walkthrough', notes: 'Show live upload and gallery rendering; verify persistence on Cloudinary.' },
    { title: 'Operational Notes', notes: 'Rollback plan, retry logic, backup recommendations.' },
    { title: 'Closing & Next Steps', notes: 'Frontend polishing, accessibility, CDN for large videos.' },
  ];

  slides.forEach((s, i) => {
    doc.addPage({ size: 'A4', margin: 50 });
    doc.rect(50, 80, 500, 300).lineWidth(1).stroke('#0b3d91');
    doc.fontSize(18).fillColor('#0b3d91').text(`Slide ${i + 1}: ${s.title}`, 60, 90);
    doc.fontSize(12).fillColor('#000').text(s.notes, 60, 120, { width: 480 });
    doc.fontSize(10).fillColor('#666').text('Speaker notes: ' + s.notes, 60, 250);
  });
}

function addAppendix() {
  doc.addPage({ size: 'A4', margin: 50 });
  addSectionHeading('Appendix: How to Test Production Endpoint');
  addParagraph('1) Obtain Vercel bypass token or open deployment in browser and copy URL.');
  addParagraph('2) Ensure env vars are set: MONGO_URI, CLOUDINARY_*, FRONTEND_URL, GMAIL_*, STRIPE_*');
  addParagraph('3) Test health: curl -i https://<DEPLOY_URL>/');
  addParagraph('4) Test upload (example):');
  addParagraph("curl -i -X POST 'https://<DEPLOY_URL>/api/admin/gallery/upload' -F 'media=@test-image.png' -F 'title=prod-test' -F 'caption=prod'\nInclude Authorization: Bearer <BYPASS_TOKEN> if protected.");
}

// Build document
addTitle('Reliance Soul Youth Initiative (RSYI)', 'Project Overview & 6-minute Presentation');
addSectionHeading('Executive Summary');
addParagraph('This document describes the RSYI full-stack project, architecture, technology choices, APIs, database design, and provides a ready 6-minute presentation script with storyboard slides.');

addNarrative();
drawArchitectureDiagram();
addTechAndAPIs();
addDatabaseSchema();
addVideoScriptAndStoryboard();
addAppendix();

// Finalize
doc.end();

stream.on('finish', () => {
  console.log('PDF generated at', outPath);
});
