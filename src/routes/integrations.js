import { Router } from 'express';
import Integration from '../models/Integration.js';
import { authenticate } from '../middleware/auth.js';
import { validateScopeRequest } from '../middleware/scopes.js';
import OAuthService from '../services/oauth.js';
import ProxyService from '../services/proxy.js';

const router = Router();

// GET /api/integrations — list all available providers
router.get('/', (req, res) => {
  const providers = Integration.listProviders();
  res.json({ providers });
});

// GET /api/integrations/:provider — get provider details
router.get('/:provider', (req, res) => {
  const provider = Integration.getProvider(req.params.provider);
  if (!provider) {
    return res.status(404).json({ error: 'not_found', message: `Provider "${req.params.provider}" not found.` });
  }
  res.json({ provider });
});

// POST /api/integrations/:provider/connect — initiate OAuth flow (auth required)
router.post('/:provider/connect', authenticate, (req, res) => {
  const { provider } = req.params;
  const { scopes } = req.body;

  const p = Integration.getProvider(provider);
  if (!p) {
    return res.status(404).json({ error: 'not_found', message: `Provider "${provider}" not found.` });
  }

  // Default to all available scopes if none requested
  const requestedScopes = Array.isArray(scopes) && scopes.length > 0
    ? scopes
    : p.scopes;

  // Validate requested scopes
  const { valid, unknown } = validateScopeRequest(provider, requestedScopes);
  if (!valid) {
    return res.status(400).json({
      error: 'invalid_scopes',
      message: `Unknown scopes for provider "${provider}": ${unknown.join(', ')}`,
      available_scopes: p.scopes,
    });
  }

  try {
    const flow = OAuthService.initiateFlow(provider, req.agent.id, requestedScopes);
    res.json({
      ...flow,
      instructions: `Redirect user to auth_url to authorize. The callback will complete the connection.`,
    });
  } catch (err) {
    res.status(500).json({ error: 'oauth_error', message: err.message });
  }
});

// GET /api/integrations/:provider/callback — OAuth callback handler
router.get('/:provider/callback', (req, res) => {
  const { provider } = req.params;
  const { code, state, error, error_description } = req.query;

  if (error) {
    return res.status(400).json({
      error: 'oauth_denied',
      message: error_description || 'OAuth authorization was denied.',
    });
  }

  if (!code || !state) {
    return res.status(400).json({ error: 'invalid_callback', message: 'Missing code or state parameter.' });
  }

  try {
    const connection = OAuthService.handleCallback(provider, code, state);
    res.json({
      success: true,
      connection: {
        provider: connection.provider,
        scopes: connection.scopes,
        connected_at: connection.connected_at,
      },
      message: `Successfully connected to ${provider}. You can now proxy API calls via POST /api/proxy/${provider}/api`,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: 'oauth_error', message: err.message });
  }
});

// GET /api/integrations/connections/list — list agent's connections (auth required)
router.get('/connections/list', authenticate, (req, res) => {
  const connections = Integration.getAgentConnections(req.agent.id);
  res.json({
    connections: connections.map(c => ({
      provider: c.provider,
      scopes: c.scopes,
      connected_at: c.connected_at,
    })),
  });
});

// POST /api/proxy/:provider/api — proxy an API call (auth required)
router.post('/proxy/:provider/api', authenticate, async (req, res) => {
  const { provider } = req.params;
  const { endpoint, method = 'GET', params = {}, body = null } = req.body;

  if (!endpoint) {
    return res.status(400).json({ error: 'validation_error', message: 'Field "endpoint" is required.' });
  }

  const ip = req.ip || req.connection.remoteAddress || '';

  try {
    const result = await ProxyService.call({
      agent: req.agent,
      provider,
      endpoint,
      method: method.toUpperCase(),
      params,
      body,
      ip,
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: 'proxy_error', message: err.message });
  }
});

export default router;
