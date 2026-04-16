# GaitAnalytics Backend

Simple backend for receiving and serving session CSV files.

## What it does

- Health check
- CSV upload endpoint
- List uploaded session CSV files
- Read or download a session CSV

## Quick start

1. Install packages:

```bash
npm install
```

2. (Optional) copy env file:

```bash
cp .env.example .env
```

3. Run in dev mode:

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
