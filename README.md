# Reliance Soul Youth — Backend

Node.js + Express REST API for the Reliance Soul Youth Foundation website. Implements gallery, bookings, contacts, donors, email notifications, and donation support via Stripe.

Tech stack
- Node.js (ES modules), Express
- Mongoose (MongoDB)
- Nodemailer (email)
- Stripe Checkout integration

Quick start

Prerequisites: Node.js 20+, npm, a MongoDB instance and configured environment variables.

Install and run in development:

```bash
cd backend
npm install
npm run start
```

Environment (important variables)
- `MONGO_URI` — MongoDB connection string
- `FRONTEND_URL` — allowed origin for CORS
- `GMAIL_USER`, `GMAIL_APP_PASSWORD` — for Nodemailer (Gmail app password recommended)
- `STRIPE_SECRET_KEY` — Stripe API key for donations
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` — admin credentials used by the API (change in production)
- Optional Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

Project structure
- `models/` — Mongoose models (Booking, Contact, Donor, Gallery, ...)
- `api/` — API route handlers
- `uploads/` — local uploads fallback for gallery media
- `server.js` — Express server entrypoint

Notes
- Media uploads are stored in `uploads/gallery/` by default; Cloudinary can be used for scalable storage.
- Stripe webhooks and Checkout are supported; configure `STRIPE_SECRET_KEY` and webhook endpoint as needed.

Deployment
- Deploy to any Node host (VPS, Heroku, Vercel serverless functions with adjustments). Ensure env vars are set and storage (Cloudinary) configured for serverless environments.

Contributing
- Open issues for bugs and feature requests. Send PRs with clear descriptions and minimal breaking changes.

Repository
- Frontend: https://github.com/Adelard-sketch/reliance-soul-youth-frontend.git
