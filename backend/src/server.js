import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const app = express();
const port = Number(process.env.PORT || 4000);
const storageMode = (process.env.STORAGE_MODE || "filesystem").trim().toLowerCase();
const isSupabaseMode = storageMode === "supabase";
const supabaseSessionsTable = (process.env.SUPABASE_SESSIONS_TABLE || "sessions").trim();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "..", "data");
const sessionsDir = path.resolve(dataDir, "sessions");

let supabase = null;
if (isSupabaseMode) {
  const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
  const supabaseServiceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("[backend] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY while STORAGE_MODE=supabase");
    process.exit(1);
  }

  supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

if (!isSupabaseMode && !fs.existsSync(sessionsDir)) {
  fs.mkdirSync(sessionsDir, { recursive: true });
}

const upload = multer({ storage: multer.memoryStorage() });

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : true;

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "5mb" }));

function sanitizeOriginalName(rawOriginalName) {
  const safeOriginalName = (rawOriginalName || "session.csv")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .toLowerCase();

  if (!safeOriginalName.endsWith(".csv")) {
    return `${safeOriginalName}.csv`;
  }

  return safeOriginalName;
}

function buildSessionFileName(originalName) {
  const safeOriginalName = sanitizeOriginalName(originalName);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${timestamp}-${safeOriginalName}`;
}

function sanitizeRequestedFileName(rawFileName) {
  const safeFileName = path.basename(rawFileName || "");
  if (!safeFileName || safeFileName !== rawFileName) {
    return null;
  }

  return safeFileName;
}

function resolveSessionFilePath(rawFileName) {
  const safeFileName = sanitizeRequestedFileName(rawFileName);
  if (!safeFileName) {
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

function saveCsvToFileSystem(fileName, csvContent) {
  const filePath = path.resolve(sessionsDir, fileName);
  fs.writeFileSync(filePath, csvContent, "utf8");
}

async function listSessionFilesFromSupabase() {
  const { data, error } = await supabase
    .from(supabaseSessionsTable)
    .select("file_name,size_bytes,created_at,updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Supabase list failed: ${error.message}`);
  }

  return (data || []).map((item) => ({
    id: item.file_name,
    fileName: item.file_name,
    size: item.size_bytes,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  }));
}

async function saveCsvToSupabase(fileName, originalName, csvContent, sizeBytes) {
  const { error } = await supabase.from(supabaseSessionsTable).insert({
    file_name: fileName,
    original_name: originalName,
    size_bytes: sizeBytes,
    csv_content: csvContent,
  });

  if (error) {
    throw new Error(`Supabase insert failed: ${error.message}`);
  }
}

async function readCsvFromSupabase(fileName) {
  const { data, error } = await supabase
    .from(supabaseSessionsTable)
    .select("file_name,csv_content")
    .eq("file_name", fileName)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase read failed: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    fileName: data.file_name,
    csvContent: data.csv_content,
  };
}

app.post("/api/sessions/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({
        ok: false,
        error: "No file uploaded. Use multipart field named 'file'.",
      });
      return;
    }

    const fileName = buildSessionFileName(req.file.originalname);
    const csvContent = req.file.buffer.toString("utf8");
    const sizeBytes = Buffer.byteLength(csvContent, "utf8");

    if (isSupabaseMode) {
      await saveCsvToSupabase(fileName, req.file.originalname, csvContent, sizeBytes);
    } else {
      saveCsvToFileSystem(fileName, csvContent);
    }

    res.status(201).json({
      ok: true,
      message: "CSV uploaded",
      storageMode,
      fileName,
      originalName: req.file.originalname,
      size: sizeBytes,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Upload failed",
    });
  }
});

app.get("/api/sessions", async (_req, res) => {
  try {
    const sessions = isSupabaseMode
      ? await listSessionFilesFromSupabase()
      : listSessionFiles();

    res.json({
      ok: true,
      storageMode,
      count: sessions.length,
      sessions,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to list sessions",
    });
  }
});

app.get("/api/sessions/:fileName", async (req, res) => {
  try {
    const requestedFileName = sanitizeRequestedFileName(req.params.fileName);
    if (!requestedFileName) {
      res.status(404).json({
        ok: false,
        error: "Session CSV not found",
      });
      return;
    }

    if (isSupabaseMode) {
      const session = await readCsvFromSupabase(requestedFileName);
      if (!session) {
        res.status(404).json({
          ok: false,
          error: "Session CSV not found",
        });
        return;
      }

      res.type("text/csv").send(session.csvContent);
      return;
    }

    const filePath = resolveSessionFilePath(requestedFileName);
    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).json({
        ok: false,
        error: "Session CSV not found",
      });
      return;
    }

    const csvContent = fs.readFileSync(filePath, "utf8");
    res.type("text/csv").send(csvContent);
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to read session",
    });
  }
});

app.get("/api/sessions/:fileName/download", async (req, res) => {
  try {
    const requestedFileName = sanitizeRequestedFileName(req.params.fileName);
    if (!requestedFileName) {
      res.status(404).json({
        ok: false,
        error: "Session CSV not found",
      });
      return;
    }

    if (isSupabaseMode) {
      const session = await readCsvFromSupabase(requestedFileName);
      if (!session) {
        res.status(404).json({
          ok: false,
          error: "Session CSV not found",
        });
        return;
      }

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${session.fileName}"`,
      );
      res.type("text/csv").send(session.csvContent);
      return;
    }

    const filePath = resolveSessionFilePath(requestedFileName);
    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).json({
        ok: false,
        error: "Session CSV not found",
      });
      return;
    }

    res.download(filePath, path.basename(filePath));
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to download session",
    });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "gaitanalytics-backend",
    storageMode,
    timestamp: new Date().toISOString(),
  });
});

app.listen(port, () => {
  console.log(`[backend] Running on http://localhost:${port}`);
});
