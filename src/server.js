/**
 * AgentAuth — Unified AI Agent Identity & Permission Management Platform
 * Main server entry point
 */

import express from 'express';
import cors from 'cors';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Import routes
import agentsRouter from './routes/agents.js';
import integrationsRouter from './routes/integrations.js';
import auditRouter from './routes/audit.js';
import dashboardRouter from './routes/dashboard.js';

// Ensure DB is initialized (side-effect import)
import './models/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve landing page & static assets
app.use(express.static(join(__dirname, 'public')));

// Request logger (dev)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    if (req.path.startsWith('/api')) {
      console.log(`${req.method} ${req.path} → ${res.statusCode} (${ms}ms)`);
    }
  });
  next();
});

// ── Health Check ───────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'AgentAuth',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ─────────────────────────────────────────
app.use('/api/agents', agentsRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/proxy', integrationsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/dashboard', dashboardRouter);

// ── Error Handling ─────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'not_found',
    message: `Route ${req.method} ${req.path} not found.`,
  });
});

app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: 'internal_error',
    message: process.env.NODE_ENV === 'production'
      ? 'An internal error occurred.'
      : err.message,
  });
});

// ── Start ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ┌─────────────────────────────────────────┐
  │                                         │
  │   🔐 AgentAuth v1.0.0                   │
  │   Running on http://localhost:${PORT}      │
  │                                         │
  │   Landing page: http://localhost:${PORT}   │
  │   API docs:     /api/health             │
  │                                         │
  └─────────────────────────────────────────┘
  `);
});

export default app;
