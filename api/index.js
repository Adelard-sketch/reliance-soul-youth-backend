// Vercel serverless function entry point
import app from '../server.js';

// Export a handler wrapper — calling the Express app directly ensures Vercel
// invokes the Express request handler function signature and lets us log
// incoming requests for debugging in deployment logs.
export default function handler(req, res) {
	try {
		console.log('[vercel] incoming', req.method, req.url);
	} catch (e) {}
	return app(req, res);
}
