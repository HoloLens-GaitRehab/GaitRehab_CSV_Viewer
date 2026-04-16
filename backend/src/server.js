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

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : true;

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "5mb" }));

function resolveSessionFilePath(rawFileName) {
  const safeFileName = path.basename(rawFileName || "");
  if (!safeFileName || safeFileName !== rawFileName) {
    return null;
  }

  const fullPath = path.resolve(sessionsDir, safeFileName);
  if (!fullPath.startsWith(sessionsDir)) {
    return null;
  }

  return fullPath;
}

function listSessionFiles() {
  const files = fs.readdirSync(sessionsDir);
  return files
    .filter((fileName) => fileName.toLowerCase().endsWith(".csv"))
    .map((fileName) => {
      const fullPath = path.resolve(sessionsDir, fileName);
      const stats = fs.statSync(fullPath);
      return {
        id: fileName,
        fileName,
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
        updatedAt: stats.mtime.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

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

app.get("/api/sessions", (_req, res) => {
  const sessions = listSessionFiles();
  res.json({
    ok: true,
    count: sessions.length,
    sessions,
  });
});

app.get("/api/sessions/:fileName", (req, res) => {
  const filePath = resolveSessionFilePath(req.params.fileName);
  if (!filePath || !fs.existsSync(filePath)) {
    res.status(404).json({
      ok: false,
      error: "Session CSV not found",
    });
    return;
  }

  const csvContent = fs.readFileSync(filePath, "utf8");
  res.type("text/csv").send(csvContent);
});

app.get("/api/sessions/:fileName/download", (req, res) => {
  const filePath = resolveSessionFilePath(req.params.fileName);
  if (!filePath || !fs.existsSync(filePath)) {
    res.status(404).json({
      ok: false,
      error: "Session CSV not found",
    });
    return;
  }

  res.download(filePath, path.basename(filePath));
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
