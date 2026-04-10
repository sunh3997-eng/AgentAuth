import jwt from 'jsonwebtoken';
import Agent from '../models/Agent.js';

const JWT_SECRET = process.env.JWT_SECRET || 'agentauth-dev-secret-change-in-production';

export function signToken(agent) {
  return jwt.sign(
    { sub: agent.id, name: agent.name },
    JWT_SECRET,
    { expiresIn: '7d', issuer: 'agentauth' }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET, { issuer: 'agentauth' });
}

export function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Missing or invalid Authorization header. Use: Bearer <token>',
    });
  }

  const token = header.slice(7);

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'Token has expired. Please re-authenticate.'
      : 'Invalid token.';
    return res.status(401).json({ error: 'unauthorized', message });
  }

  const agent = Agent.findById(payload.sub);
  if (!agent) {
    return res.status(401).json({ error: 'unauthorized', message: 'Agent not found.' });
  }

  req.agent = agent;
  next();
}
