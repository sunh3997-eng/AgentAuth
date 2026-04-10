import db from './db.js';
import { v4 as uuidv4 } from 'uuid';

export const Agent = {
  create({ name, description = '', scopes = [] }) {
    const id = `agent_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    const api_key = `aa_${uuidv4().replace(/-/g, '')}`;
    const now = Date.now();

    db.prepare(`
      INSERT INTO agents (id, name, description, api_key, scopes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, description, api_key, JSON.stringify(scopes), now, now);

    return this.findById(id);
  },

  findById(id) {
    const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
    return row ? this._parse(row) : null;
  },

  findByApiKey(api_key) {
    const row = db.prepare('SELECT * FROM agents WHERE api_key = ?').get(api_key);
    return row ? this._parse(row) : null;
  },

  updateScopes(id, scopes) {
    const now = Date.now();
    db.prepare('UPDATE agents SET scopes = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(scopes), now, id);
    return this.findById(id);
  },

  list() {
    return db.prepare('SELECT * FROM agents ORDER BY created_at DESC')
      .all()
      .map(this._parse);
  },

  _parse(row) {
    return {
      ...row,
      scopes: JSON.parse(row.scopes || '[]'),
    };
  },
};

export default Agent;
