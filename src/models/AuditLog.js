import db from './db.js';
import { v4 as uuidv4 } from 'uuid';

export const AuditLog = {
  create({ agent_id, provider, endpoint, method = 'GET', status = 200, scopes_used = [], ip = '', duration_ms = 0 }) {
    const id = `log_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    const now = Date.now();

    db.prepare(`
      INSERT INTO audit_logs (id, agent_id, provider, endpoint, method, status, scopes_used, ip, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, agent_id, provider, endpoint, method, status, JSON.stringify(scopes_used), ip, duration_ms, now);

    return this.findById(id);
  },

  findById(id) {
    const row = db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(id);
    return row ? this._parse(row) : null;
  },

  list({ agent_id, provider, start, end, limit = 100, offset = 0 } = {}) {
    const conditions = [];
    const params = [];

    if (agent_id) {
      conditions.push('agent_id = ?');
      params.push(agent_id);
    }
    if (provider) {
      conditions.push('provider = ?');
      params.push(provider);
    }
    if (start) {
      conditions.push('created_at >= ?');
      params.push(Number(start));
    }
    if (end) {
      conditions.push('created_at <= ?');
      params.push(Number(end));
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const safeLimit = Math.min(Math.max(1, Number(limit) || 100), 500);
    const safeOffset = Math.max(0, Number(offset) || 0);

    const rows = db.prepare(`
      SELECT * FROM audit_logs ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, safeLimit, safeOffset);

    const { total } = db.prepare(`
      SELECT COUNT(*) as total FROM audit_logs ${where}
    `).get(...params);

    return { rows: rows.map(this._parse), total };
  },

  stats() {
    const totalCalls = db.prepare('SELECT COUNT(*) as n FROM audit_logs').get().n;
    const totalAgents = db.prepare('SELECT COUNT(*) as n FROM agents').get().n;
    const totalConnections = db.prepare('SELECT COUNT(*) as n FROM connections').get().n;

    const byProvider = db.prepare(`
      SELECT provider, COUNT(*) as calls, AVG(duration_ms) as avg_ms
      FROM audit_logs
      GROUP BY provider
      ORDER BY calls DESC
    `).all();

    const byStatus = db.prepare(`
      SELECT
        SUM(CASE WHEN status < 400 THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as error
      FROM audit_logs
    `).get();

    const recentActivity = db.prepare(`
      SELECT DATE(created_at / 1000, 'unixepoch') as day, COUNT(*) as calls
      FROM audit_logs
      WHERE created_at >= ?
      GROUP BY day
      ORDER BY day ASC
    `).all(Date.now() - 7 * 24 * 60 * 60 * 1000);

    return {
      totalCalls,
      totalAgents,
      totalConnections,
      byProvider,
      successRate: totalCalls ? Math.round((byStatus.success / totalCalls) * 100) : 100,
      errorRate: totalCalls ? Math.round((byStatus.error / totalCalls) * 100) : 0,
      recentActivity,
    };
  },

  _parse(row) {
    return {
      ...row,
      scopes_used: JSON.parse(row.scopes_used || '[]'),
    };
  },
};

export default AuditLog;
