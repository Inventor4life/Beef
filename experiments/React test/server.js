import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// (Optional) if you also have API routes later, they'd go before static hosting
app.get("/api/health", (req, res) => res.json({ ok: true }));

// Serve the built React files
const distPath = path.join(__dirname, "../dist");
app.use(express.static(distPath));

// SPA fallback: any non-API route returns index.html
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(distPath, "index.html"));
});

// --- HOST + PORT ---
const PORT = process.env.PORT || 3001;

// IMPORTANT:
// - "0.0.0.0" means listen on all network interfaces (recommended)
// - If you put a specific IP, it must be an IP actually assigned to this machine
const HOST = process.env.HOST || "10.59.197.63";

app.listen(PORT, HOST, () => {
  console.log(`Serving React on http://${HOST}:${PORT}`);
});
