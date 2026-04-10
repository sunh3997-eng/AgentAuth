import { Router } from 'express';
import AuditLog from '../models/AuditLog.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /api/audit — list audit logs (auth required)
// Query params: provider, start, end, limit, offset
router.get('/', authenticate, (req, res) => {
  const { provider, start, end, limit, offset } = req.query;

  const { rows, total } = AuditLog.list({
    agent_id: req.agent.id, // agents see only their own logs
    provider,
    start: start ? Number(start) : undefined,
    end:   end   ? Number(end)   : undefined,
    limit:  limit  ? Number(limit)  : 100,
    offset: offset ? Number(offset) : 0,
  });

  res.json({
    logs: rows,
    total,
    limit:  Number(limit)  || 100,
    offset: Number(offset) || 0,
  });
});

export default router;
