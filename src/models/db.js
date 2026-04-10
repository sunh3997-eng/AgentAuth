import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');

mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(join(DATA_DIR, 'agentauth.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    api_key     TEXT NOT NULL UNIQUE,
    scopes      TEXT NOT NULL DEFAULT '[]',
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS providers (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL,
    logo        TEXT NOT NULL,
    auth_url    TEXT NOT NULL,
    token_url   TEXT NOT NULL,
    api_base    TEXT NOT NULL,
    scopes      TEXT NOT NULL DEFAULT '[]',
    color       TEXT NOT NULL DEFAULT '#6366f1'
  );

  CREATE TABLE IF NOT EXISTS connections (
    id           TEXT PRIMARY KEY,
    agent_id     TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    provider     TEXT NOT NULL REFERENCES providers(id),
    access_token TEXT NOT NULL,
    scopes       TEXT NOT NULL DEFAULT '[]',
    connected_at INTEGER NOT NULL,
    UNIQUE(agent_id, provider)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id           TEXT PRIMARY KEY,
    agent_id     TEXT NOT NULL,
    provider     TEXT NOT NULL,
    endpoint     TEXT NOT NULL,
    method       TEXT NOT NULL DEFAULT 'GET',
    status       INTEGER NOT NULL DEFAULT 200,
    scopes_used  TEXT NOT NULL DEFAULT '[]',
    ip           TEXT NOT NULL DEFAULT '',
    duration_ms  INTEGER NOT NULL DEFAULT 0,
    created_at   INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_audit_agent    ON audit_logs(agent_id);
  CREATE INDEX IF NOT EXISTS idx_audit_provider ON audit_logs(provider);
  CREATE INDEX IF NOT EXISTS idx_audit_created  ON audit_logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_conn_agent     ON connections(agent_id);
`);

// Seed the 5 mock SaaS providers
const seedProviders = db.prepare(`
  INSERT OR IGNORE INTO providers (id, name, description, logo, auth_url, token_url, api_base, scopes, color)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const seedMany = db.transaction(() => {
  seedProviders.run(
    'github',
    'GitHub',
    'Access repositories, issues, pull requests, and more via the GitHub API.',
    '🐙',
    'https://github.com/login/oauth/authorize',
    'https://github.com/login/oauth/access_token',
    'https://api.github.com',
    JSON.stringify(['github:read', 'github:write', 'github:repos', 'github:issues', 'github:pull_requests']),
    '#24292e'
  );

  seedProviders.run(
    'slack',
    'Slack',
    'Send messages, manage channels, and interact with workspaces via Slack API.',
    '💬',
    'https://slack.com/oauth/v2/authorize',
    'https://slack.com/api/oauth.v2.access',
    'https://slack.com/api',
    JSON.stringify(['slack:read', 'slack:write', 'slack:channels', 'slack:messages:write', 'slack:files:read']),
    '#4a154b'
  );

  seedProviders.run(
    'google',
    'Google',
    'Access Gmail, Drive, Calendar, and other Google Workspace services.',
    '🔵',
    'https://accounts.google.com/o/oauth2/v2/auth',
    'https://oauth2.googleapis.com/token',
    'https://www.googleapis.com',
    JSON.stringify(['google:read', 'google:write', 'google:calendar', 'google:drive', 'google:gmail']),
    '#4285f4'
  );

  seedProviders.run(
    'notion',
    'Notion',
    'Read and write Notion pages, databases, and workspace content.',
    '📝',
    'https://api.notion.com/v1/oauth/authorize',
    'https://api.notion.com/v1/oauth/token',
    'https://api.notion.com/v1',
    JSON.stringify(['notion:read', 'notion:write', 'notion:pages', 'notion:databases', 'notion:blocks']),
    '#000000'
  );

  seedProviders.run(
    'linear',
    'Linear',
    'Manage issues, projects, cycles, and teams via the Linear API.',
    '🔺',
    'https://linear.app/oauth/authorize',
    'https://api.linear.app/oauth/token',
    'https://api.linear.app/graphql',
    JSON.stringify(['linear:read', 'linear:write', 'linear:issues', 'linear:projects', 'linear:cycles']),
    '#5e6ad2'
  );
});

seedMany();

export default db;
