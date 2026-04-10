import { v4 as uuidv4 } from 'uuid';
import Integration from '../models/Integration.js';

// In-memory state store for OAuth flow (production: use Redis/DB)
const pendingStates = new Map();

export const OAuthService = {
  /**
   * Initiate OAuth flow — returns the redirect URL.
   */
  initiateFlow(provider, agent_id, requestedScopes) {
    const p = Integration.getProvider(provider);
    if (!p) throw new Error(`Unknown provider: ${provider}`);

    const state = uuidv4();
    const scopeStr = requestedScopes.join(' ');

    pendingStates.set(state, {
      agent_id,
      provider,
      scopes: requestedScopes,
      expires_at: Date.now() + 10 * 60 * 1000, // 10 min
    });

    // Cleanup old states
    for (const [k, v] of pendingStates) {
      if (v.expires_at < Date.now()) pendingStates.delete(k);
    }

    const params = new URLSearchParams({
      client_id: `agentauth_client_${provider}`,
      redirect_uri: `${process.env.BASE_URL || 'http://localhost:3000'}/api/integrations/${provider}/callback`,
      scope: scopeStr,
      state,
      response_type: 'code',
    });

    return {
      auth_url: `${p.auth_url}?${params}`,
      state,
      provider,
      scopes: requestedScopes,
    };
  },

  /**
   * Handle OAuth callback — exchange code for (mock) token and store connection.
   */
  handleCallback(provider, code, state) {
    const pending = pendingStates.get(state);

    if (!pending) {
      throw Object.assign(new Error('Invalid or expired OAuth state.'), { status: 400 });
    }
    if (pending.expires_at < Date.now()) {
      pendingStates.delete(state);
      throw Object.assign(new Error('OAuth state has expired. Please reconnect.'), { status: 400 });
    }
    if (pending.provider !== provider) {
      throw Object.assign(new Error('Provider mismatch in OAuth callback.'), { status: 400 });
    }

    pendingStates.delete(state);

    // Mock token exchange — in production, call p.token_url
    const access_token = `mock_${provider}_token_${uuidv4().replace(/-/g, '').slice(0, 24)}`;

    const connection = Integration.connect({
      agent_id: pending.agent_id,
      provider,
      access_token,
      scopes: pending.scopes,
    });

    return connection;
  },
};

export default OAuthService;
