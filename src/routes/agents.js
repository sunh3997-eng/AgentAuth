import { Router } from 'express';
import Agent from '../models/Agent.js';
import { signToken, authenticate } from '../middleware/auth.js';

const router = Router();

// POST /api/agents — register a new agent
router.post('/', (req, res) => {
  const { name, description, scopes } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'validation_error', message: 'Field "name" is required.' });
  }
  if (name.trim().length > 100) {
    return res.status(400).json({ error: 'validation_error', message: '"name" must be 100 characters or fewer.' });
  }
  if (scopes !== undefined && !Array.isArray(scopes)) {
    return res.status(400).json({ error: 'validation_error', message: '"scopes" must be an array of strings.' });
  }

  const agent = Agent.create({
    name: name.trim(),
    description: typeof description === 'string' ? description.trim().slice(0, 500) : '',
    scopes: Array.isArray(scopes) ? scopes.filter(s => typeof s === 'string') : [],
  });

  res.status(201).json({
    agent: {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      scopes: agent.scopes,
      created_at: agent.created_at,
    },
    api_key: agent.api_key,
    message: 'Agent registered. Save your api_key — it will not be shown again.',
  });
});

// POST /api/agents/token — exchange api_key for JWT
router.post('/token', (req, res) => {
  const { api_key } = req.body;

  if (!api_key) {
    return res.status(400).json({ error: 'validation_error', message: 'Field "api_key" is required.' });
  }

  const agent = Agent.findByApiKey(api_key);
  if (!agent) {
    return res.status(401).json({ error: 'invalid_api_key', message: 'Invalid API key.' });
  }

  const token = signToken(agent);

  res.json({
    token,
    token_type: 'Bearer',
    expires_in: 604800, // 7 days in seconds
    agent: {
      id: agent.id,
      name: agent.name,
      scopes: agent.scopes,
    },
  });
});

// PUT /api/agents/:id/scopes — update agent scopes (auth required)
router.put('/:id/scopes', authenticate, (req, res) => {
  const { id } = req.params;

  // Agents can only update their own scopes
  if (req.agent.id !== id) {
    return res.status(403).json({ error: 'forbidden', message: 'You can only update your own agent scopes.' });
  }

  const { scopes } = req.body;
  if (!Array.isArray(scopes)) {
    return res.status(400).json({ error: 'validation_error', message: '"scopes" must be an array of strings.' });
  }

  const validScopes = scopes.filter(s => typeof s === 'string' && s.trim().length > 0);
  const agent = Agent.updateScopes(id, validScopes);

  res.json({
    agent: {
      id: agent.id,
      name: agent.name,
      scopes: agent.scopes,
      updated_at: agent.updated_at,
    },
  });
});

// GET /api/agents/me — get current agent info
router.get('/me', authenticate, (req, res) => {
  const agent = req.agent;
  res.json({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    scopes: agent.scopes,
    created_at: agent.created_at,
    updated_at: agent.updated_at,
  });
});

export default router;
