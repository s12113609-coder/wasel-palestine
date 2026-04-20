const { query, withTransaction } = require('../config/database');
const { paginate, paginatedResponse } = require('../utils/pagination');
const { cacheGet, cacheSet, cacheDel } = require('../config/redis');
const alertService = require('../services/alertService');

exports.list = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req);
    const { status, type, severity, region, sort = 'created_at', order = 'DESC' } = req.query;

    const cacheKey = `incidents:${JSON.stringify(req.query)}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const conditions = [];
    const params = [];
    let idx = 1;

    if (status) { conditions.push(`i.status = $${idx++}`); params.push(status); }
    if (type) { conditions.push(`i.type = $${idx++}`); params.push(type); }
    if (severity) { conditions.push(`i.severity = $${idx++}`); params.push(severity); }
    if (region) { conditions.push(`i.region ILIKE $${idx++}`); params.push(`%${region}%`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const allowedSort = ['created_at', 'severity', 'status', 'type'];
    const sortCol = allowedSort.includes(sort) ? sort : 'created_at';
    const sortDir = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countResult = await query(`SELECT COUNT(*) FROM incidents i ${where}`, params);
    const total = countResult.rows[0].count;

    params.push(limit, offset);
    const result = await query(`
      SELECT i.*, 
        u.username as reporter_username,
        c.name as checkpoint_name
      FROM incidents i
      LEFT JOIN users u ON u.id = i.reported_by
      LEFT JOIN checkpoints c ON c.id = i.checkpoint_id
      ${where}
      ORDER BY i.${sortCol} ${sortDir}
      LIMIT $${idx++} OFFSET $${idx++}
    `, params);

    const response = paginatedResponse(result.rows, total, page, limit);
    await cacheSet(cacheKey, response, 60);
    res.json(response);
  } catch (err) {
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT i.*, 
        u.username as reporter_username,
        m.username as verifier_username,
        c.name as checkpoint_name, c.latitude as cp_lat, c.longitude as cp_lng
      FROM incidents i
      LEFT JOIN users u ON u.id = i.reported_by
      LEFT JOIN users m ON m.id = i.verified_by
      LEFT JOIN checkpoints c ON c.id = i.checkpoint_id
      WHERE i.id = $1
    `, [id]);

    if (!result.rows[0]) return res.status(404).json({ error: 'Incident not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { title, description, type, severity, latitude, longitude, checkpoint_id, region } = req.body;

    const result = await query(`
      INSERT INTO incidents (title, description, type, severity, latitude, longitude, checkpoint_id, region, reported_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `, [title, description, type, severity || 'medium', latitude, longitude, checkpoint_id || null, region, req.user.id]);

    await query(`
      INSERT INTO incident_audit_log (incident_id, action, new_status, performed_by)
      VALUES ($1, 'created', 'active', $2)
    `, [result.rows[0].id, req.user.id]);

    await cacheDel('incidents:*');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, type, severity, status, region, notes } = req.body;

    const existing = await query('SELECT * FROM incidents WHERE id=$1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Incident not found' });

    const incident = existing.rows[0];
    const result = await query(`
      UPDATE incidents SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        type = COALESCE($3, type),
        severity = COALESCE($4, severity),
        status = COALESCE($5, status),
        region = COALESCE($6, region),
        verified_by = CASE WHEN $5 = 'verified' THEN $7 ELSE verified_by END,
        verified_at = CASE WHEN $5 = 'verified' THEN NOW() ELSE verified_at END,
        resolved_at = CASE WHEN $5 = 'resolved' THEN NOW() ELSE resolved_at END,
        updated_at = NOW()
      WHERE id = $8 RETURNING *
    `, [title, description, type, severity, status, region, req.user.id, id]);

    await query(`
      INSERT INTO incident_audit_log (incident_id, action, old_status, new_status, performed_by, notes)
      VALUES ($1, 'updated', $2, $3, $4, $5)
    `, [id, incident.status, status || incident.status, req.user.id, notes]);

    if (status === 'verified') {
      await alertService.triggerAlerts(result.rows[0]);
    }

    await cacheDel(`incidents:*`);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM incidents WHERE id=$1 RETURNING id', [id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Incident not found' });
    await cacheDel('incidents:*');
    res.json({ message: 'Incident deleted' });
  } catch (err) {
    next(err);
  }
};

exports.getAuditLog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT al.*, u.username as performed_by_username
      FROM incident_audit_log al
      LEFT JOIN users u ON u.id = al.performed_by
      WHERE al.incident_id = $1
      ORDER BY al.created_at DESC
    `, [id]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};
