const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  if (err.code === '23505') {
    return res.status(409).json({ error: 'Duplicate entry', detail: err.detail });
  }
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced resource not found' });
  }

  const status = err.status || err.statusCode || 500;
  const message = status < 500 ? err.message : 'Internal server error';

  res.status(status).json({ error: message });
};

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      error: 'Validation failed',
      details: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

const notFound = (req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
};

module.exports = { errorHandler, validate, notFound };
