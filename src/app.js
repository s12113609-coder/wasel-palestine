require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

// ── Security & Middleware ─────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.originalUrl}`);
    next();
});

// Global rate limiter
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Stricter limiter for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many auth attempts.' },
});
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);

// ── Health Check ──────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'wasel-palestine-api',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});

// ── API Routes ────────────────────────────────────────────────────
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/incidents', require('./routes/incidents'));
app.use('/api/v1/checkpoints', require('./routes/checkpoints'));
app.use('/api/v1/reports', require('./routes/reports'));
app.use('/api/v1/routes', require('./routes/routes'));
app.use('/api/v1/alerts', require('./routes/alerts'));
app.use('/api/v1/stats', require('./routes/stats'));

// ── 404 & Error Handler ───────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('REAL ERROR:', err.message || err);
    next(err);
});


app.use(notFound);
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
if (require.main === module) {
    app.listen(PORT, () => {
        logger.info(`🚀 Wasel Palestine API running on port ${PORT}`);
        logger.info(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
}

module.exports = app;