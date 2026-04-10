import AuditLog from '../models/AuditLog.js';
import Integration from '../models/Integration.js';

// Mock response templates per provider
const MOCK_RESPONSES = {
  github: {
    '/repos': { data: [{ id: 1, name: 'my-repo', full_name: 'agent/my-repo', private: false, stargazers_count: 42 }] },
    '/issues': { data: [{ id: 101, title: 'Fix auth bug', state: 'open', number: 7 }] },
    '/pulls': { data: [{ id: 201, title: 'Add OAuth support', state: 'open', number: 3 }] },
    '/user': { login: 'agentauth-bot', id: 999, type: 'Bot' },
  },
  slack: {
    '/conversations.list': { ok: true, channels: [{ id: 'C01', name: 'general' }, { id: 'C02', name: 'engineering' }] },
    '/chat.postMessage': { ok: true, ts: String(Date.now() / 1000) },
    '/auth.test': { ok: true, user: 'agentauth-bot', team: 'MyWorkspace' },
  },
  google: {
    '/calendar/v3/calendars/primary/events': { kind: 'calendar#events', items: [{ id: 'evt1', summary: 'Team standup' }] },
    '/drive/v3/files': { kind: 'drive#fileList', files: [{ id: 'file1', name: 'Q4 Report.pdf', mimeType: 'application/pdf' }] },
    '/gmail/v1/users/me/messages': { messages: [{ id: 'msg1', threadId: 'thread1' }], resultSizeEstimate: 1 },
  },
  notion: {
    '/pages': { object: 'list', results: [{ id: 'page1', object: 'page', url: 'https://notion.so/page1' }] },
    '/databases': { object: 'list', results: [{ id: 'db1', title: [{ text: { content: 'Tasks' } }] }] },
    '/search': { object: 'list', results: [], total_count: 0 },
  },
  linear: {
    '/issues': { data: { issues: { nodes: [{ id: 'iss1', title: 'Implement auth flow', state: { name: 'In Progress' } }] } } },
    '/projects': { data: { projects: { nodes: [{ id: 'proj1', name: 'AgentAuth MVP', progress: 0.6 }] } } },
    '/cycles': { data: { cycles: { nodes: [{ id: 'cyc1', number: 12, completedAt: null }] } } },
  },
};

function getMockResponse(provider, endpoint) {
  const providerMocks = MOCK_RESPONSES[provider] || {};
  // Find the best matching path
  for (const [path, resp] of Object.entries(providerMocks)) {
    if (endpoint.includes(path)) return resp;
  }
  return { mock: true, provider, endpoint, message: 'Mock response — no specific template for this endpoint.' };
}

export const ProxyService = {
  async call({ agent, provider, endpoint, method = 'GET', params = {}, body = null, ip = '' }) {
    const start = Date.now();

    const p = Integration.getProvider(provider);
    if (!p) {
      throw Object.assign(new Error(`Unknown provider: ${provider}`), { status: 400 });
    }

    const connection = Integration.getConnection(agent.id, provider);
    if (!connection) {
      throw Object.assign(
        new Error(`Not connected to ${provider}. POST /api/integrations/${provider}/connect first.`),
        { status: 403 }
      );
    }

    // Determine which scopes this endpoint requires based on method
    const requiredScope = method === 'GET'
      ? `${provider}:read`
      : `${provider}:write`;

    const grantedScopes = new Set(connection.scopes);
    const scopesUsed = [requiredScope];

    if (!grantedScopes.has(requiredScope)) {
      const duration = Date.now() - start;
      AuditLog.create({
        agent_id: agent.id,
        provider,
        endpoint,
        method,
        status: 403,
        scopes_used: scopesUsed,
        ip,
        duration_ms: duration,
      });

      throw Object.assign(
        new Error(`Insufficient scope. Required: ${requiredScope}. Granted: ${[...grantedScopes].join(', ')}`),
        { status: 403 }
      );
    }

    // Simulate minor latency
    const mockResponse = getMockResponse(provider, endpoint);
    const duration = Date.now() - start + Math.floor(Math.random() * 80 + 20);

    AuditLog.create({
      agent_id: agent.id,
      provider,
      endpoint,
      method,
      status: 200,
      scopes_used: scopesUsed,
      ip,
      duration_ms: duration,
    });

    return {
      provider,
      endpoint,
      method,
      status: 200,
      duration_ms: duration,
      data: mockResponse,
    };
  },
};

export default ProxyService;
