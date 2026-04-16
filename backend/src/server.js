import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const port = Number(process.env.PORT || 4000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "..", "data");
const sessionsDir = path.resolve(dataDir, "sessions");

if (!fs.existsSync(sessionsDir)) {
  fs.mkdirSync(sessionsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, sessionsDir);
  },
  filename: (_req, file, cb) => {
    const safeOriginalName = (file.originalname || "session.csv")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    cb(null, `${timestamp}-${safeOriginalName}`);
  },
});

const upload = multer({ storage });

app.use(cors({ origin: true }));
app.use(express.json({ limit: "5mb" }));

app.post("/api/sessions/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({
      ok: false,
      error: "No file uploaded. Use multipart field named 'file'.",
    });
    return;
  }

  res.status(201).json({
    ok: true,
    message: "CSV uploaded",
    fileName: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "gaitanalytics-backend",
    timestamp: new Date().toISOString(),
  });
});

app.listen(port, () => {
  console.log(`[backend] Running on http://localhost:${port}`);
});
