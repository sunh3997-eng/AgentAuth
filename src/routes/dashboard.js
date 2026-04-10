import { Router } from 'express';
import AuditLog from '../models/AuditLog.js';

const router = Router();

// GET /api/dashboard/stats — usage statistics (public for MVP demo)
router.get('/stats', (req, res) => {
  const stats = AuditLog.stats();
  res.json({ stats });
});

export default router;
