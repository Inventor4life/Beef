import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";
import fs from "fs";
import cookieParser from "cookie-parser";
import { OAuth2Client } from "google-auth-library";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// IMPORTANT: matches your original code needs
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // <-- needed for Google's form POST body

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

// React build output
const distPath = path.join(__dirname, "../dist");
app.use(express.static(distPath));

// Google token verification (same idea as your original verifyJWT)
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID; // set on server
const authClient = new OAuth2Client({ clientId: CLIENT_ID });

async function verifyJWT(token) {
  const ticket = await authClient.verifyIdToken({ idToken: token, audience: CLIENT_ID });
  return ticket.getPayload();
}

// ---- This mirrors your original /auth GET + POST ----
app.get("/auth", (req, res) => {
  // Serve the SPA page (same role as your original index.html sendFile)
  res.sendFile(path.join(distPath, "index.html"));
});

app.post("/auth", async (req, res) => {
  console.log("received POST, running tests...");

  // Google's POST includes: credential, g_csrf_token
  const { credential, g_csrf_token } = req.body;

  if (req.cookies.g_csrf_token && req.cookies.g_csrf_token === g_csrf_token) {
    console.log("csrf test passed");
    try {
      const payload = await verifyJWT(credential);
      console.log(`JWT verification (sub): ${payload?.sub}`);
      console.log(`JWT name: ${payload?.given_name || payload?.name}`);
      console.log(`JWT email: ${payload?.email}`);

      // (Optional) You can set your own cookie/session here later.
    } catch (e) {
      console.log("JWT verification failed");
    }
  } else {
    console.log("csrf test failed");
  }

  // Like your original: send page back
  res.sendFile(path.join(distPath, "index.html"));
});

// SPA fallback (keep this AFTER /auth so it doesn't swallow it)
app.use((req, res, next) => {
  if (req.path.startsWith("/api") || req.path === "/auth") return next();
  res.sendFile(path.join(distPath, "index.html"));
});

// HTTPS (needed for LAN IP use with Google sign-in)
const key = fs.readFileSync("./certs/key.pem");
const cert = fs.readFileSync("./certs/cert.pem");
https.createServer({ key, cert }, app).listen(PORT, HOST, () => {
  console.log(`Serving on https://${HOST}:${PORT}`);
});
