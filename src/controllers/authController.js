const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../config/database');

const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
  const refreshToken = crypto.randomBytes(64).toString('hex');
  return { accessToken, refreshToken };
};

exports.register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    const existing = await query('SELECT id FROM users WHERE email=$1 OR username=$2', [email, username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email or username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1,$2,$3) RETURNING id, username, email, role',
      [username, email, passwordHash]
    );

    const user = result.rows[0];
    const { accessToken, refreshToken } = generateTokens(user.id);

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)', [user.id, tokenHash, expiresAt]);

    res.status(201).json({ user, accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const result = await query('SELECT * FROM users WHERE email=$1 AND is_active=true', [email]);
    if (!result.rows[0]) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens(user.id);
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)', [user.id, tokenHash, expiresAt]);

    const { password_hash, ...userData } = user;
    res.json({ user: userData, accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
};

exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const result = await query(
      'SELECT rt.*, u.id as uid, u.is_active FROM refresh_tokens rt JOIN users u ON u.id=rt.user_id WHERE rt.token_hash=$1 AND rt.expires_at > NOW()',
      [tokenHash]
    );

    if (!result.rows[0] || !result.rows[0].is_active) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const { uid } = result.rows[0];
    await query('DELETE FROM refresh_tokens WHERE token_hash=$1', [tokenHash]);

    const tokens = generateTokens(uid);
    const newHash = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)', [uid, newHash, expiresAt]);

    res.json(tokens);
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await query('DELETE FROM refresh_tokens WHERE token_hash=$1', [tokenHash]);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res) => {
  const { password_hash, ...user } = req.user;
  res.json(user);
};
