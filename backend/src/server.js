import express from "express";
import cors from "cors";

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors({ origin: true }));
app.use(express.json({ limit: "5mb" }));

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
