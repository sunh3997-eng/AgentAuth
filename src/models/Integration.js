import db from './db.js';
import { v4 as uuidv4 } from 'uuid';

export const Integration = {
  listProviders() {
    return db.prepare('SELECT * FROM providers ORDER BY name')
      .all()
      .map(this._parseProvider);
  },

  getProvider(id) {
    const row = db.prepare('SELECT * FROM providers WHERE id = ?').get(id);
    return row ? this._parseProvider(row) : null;
  },

  connect({ agent_id, provider, access_token, scopes = [] }) {
    const id = `conn_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    const now = Date.now();

    db.prepare(`
      INSERT INTO connections (id, agent_id, provider, access_token, scopes, connected_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(agent_id, provider) DO UPDATE SET
        access_token = excluded.access_token,
        scopes       = excluded.scopes,
        connected_at = excluded.connected_at
    `).run(id, agent_id, provider, access_token, JSON.stringify(scopes), now);

    return this.getConnection(agent_id, provider);
  },

  getConnection(agent_id, provider) {
    const row = db.prepare(
      'SELECT * FROM connections WHERE agent_id = ? AND provider = ?'
    ).get(agent_id, provider);
    return row ? this._parseConn(row) : null;
  },

  getAgentConnections(agent_id) {
    return db.prepare('SELECT * FROM connections WHERE agent_id = ?')
      .all(agent_id)
      .map(this._parseConn);
  },

  _parseProvider(row) {
    return {
      ...row,
      scopes: JSON.parse(row.scopes || '[]'),
    };
  },

  _parseConn(row) {
    return {
      ...row,
      scopes: JSON.parse(row.scopes || '[]'),
    };
  },
};

export default Integration;
