import Integration from '../models/Integration.js';

/**
 * Factory that returns middleware requiring an agent to have a valid
 * connection to `provider` AND all `required` scopes granted.
 */
export function requireScopes(provider, required = []) {
  return (req, res, next) => {
    const agent = req.agent;

    const connection = Integration.getConnection(agent.id, provider);
    if (!connection) {
      return res.status(403).json({
        error: 'not_connected',
        message: `Agent is not connected to provider "${provider}". POST /api/integrations/${provider}/connect first.`,
      });
    }

    if (required.length > 0) {
      const granted = new Set(connection.scopes);
      const missing = required.filter(s => !granted.has(s));

      if (missing.length > 0) {
        return res.status(403).json({
          error: 'insufficient_scopes',
          message: `Missing required scopes: ${missing.join(', ')}`,
          required,
          granted: connection.scopes,
          missing,
        });
      }
    }

    req.connection = connection;
    next();
  };
}

/**
 * Validate that requested scopes are subset of what the provider offers.
 */
export function validateScopeRequest(provider, requestedScopes) {
  const p = Integration.getProvider(provider);
  if (!p) return { valid: false, unknown: requestedScopes };

  const available = new Set(p.scopes);
  const unknown = requestedScopes.filter(s => !available.has(s));
  return { valid: unknown.length === 0, unknown, available: p.scopes };
}
