# GaitAnalytics Backend

Simple backend for receiving and serving session CSV files.

## What it does

- Health check
- CSV upload endpoint
- List uploaded session CSV files
- Read or download a session CSV

## Storage modes

This backend supports two storage modes:

- `filesystem` (default): stores CSV files on local disk (`backend/data/sessions`).
- `supabase`: stores CSV content and metadata in Supabase table storage.

For cloud persistence on Render, use `supabase` mode.

## Quick start

1. Install packages:

```bash
npm install
```

2. (Optional) copy env file:

```bash
cp .env.example .env
```

3. Configure environment variables.

Minimum for local filesystem mode:

- `PORT=4000`
- `CORS_ORIGIN=http://localhost:5173`
- `STORAGE_MODE=filesystem`

Minimum for Supabase mode:

- `STORAGE_MODE=supabase`
- `SUPABASE_URL=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`
- `SUPABASE_SESSIONS_TABLE=sessions`

4. Run in dev mode:

```bash
npm run dev
```

Server default URL:

- http://localhost:4000

## API

### Health

- `GET /api/health`

### Upload CSV

- `POST /api/sessions/upload`
- Use `multipart/form-data`
- File field name must be `file`

Example curl:

```bash
curl -X POST http://localhost:4000/api/sessions/upload \
  -F "file=@session_metrics.csv"
```

### List sessions

- `GET /api/sessions`

### Read one session CSV

- `GET /api/sessions/:fileName`

### Download one session CSV

- `GET /api/sessions/:fileName/download`

## Notes for HoloLens

- Point Unity upload URL to your backend public URL.
- If you use browser frontend on another domain, set `CORS_ORIGIN`.

## Supabase setup

1. Open Supabase SQL editor.
2. Run [supabase-schema.sql](supabase-schema.sql).
3. In backend environment, set:
  - `STORAGE_MODE=supabase`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_SESSIONS_TABLE=sessions`
4. Redeploy backend.

After deployment, verify:

- `GET /api/health` returns `"storageMode": "supabase"`
- `GET /api/sessions` lists persisted sessions
