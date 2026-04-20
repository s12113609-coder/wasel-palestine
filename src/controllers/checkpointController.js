const { query } = require('../config/database');
const { paginate, paginatedResponse } = require('../utils/pagination');
const { cacheGet, cacheSet } = require('../config/redis');

exports.list = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req);
    const { region, type, is_active } = req.query;

    const cacheKey = `checkpoints:${JSON.stringify(req.query)}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const conditions = [];
    const params = [];
    let idx = 1;

    if (region) { conditions.push(`region ILIKE $${idx++}`); params.push(`%${region}%`); }
    if (type) { conditions.push(`type = $${idx++}`); params.push(type); }
    if (is_active !== undefined) { conditions.push(`is_active = $${idx++}`); params.push(is_active === 'true'); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await query(`SELECT COUNT(*) FROM checkpoints ${where}`, params);
    params.push(limit, offset);

    const result = await query(`
      SELECT c.*,
        (SELECT status FROM checkpoint_status_history WHERE checkpoint_id=c.id ORDER BY created_at DESC LIMIT 1) as current_status
      FROM checkpoints c
      ${where}
      ORDER BY c.name ASC
      LIMIT $${idx++} OFFSET $${idx++}
    `, params);

    const response = paginatedResponse(result.rows, countResult.rows[0].count, page, limit);
    await cacheSet(cacheKey, response, 120);
    res.json(response);
  } catch (err) {
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM checkpoints WHERE id=$1', [id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Checkpoint not found' });

    const history = await query(`
      SELECT csh.*, u.username as reported_by_username
      FROM checkpoint_status_history csh
      LEFT JOIN users u ON u.id = csh.reported_by
      WHERE csh.checkpoint_id = $1
      ORDER BY csh.created_at DESC
      LIMIT 20
    `, [id]);

    res.json({ ...result.rows[0], statusHistory: history.rows });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { name, name_ar, latitude, longitude, type, region } = req.body;
    const result = await query(`
      INSERT INTO checkpoints (name, name_ar, latitude, longitude, type, region)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [name, name_ar, latitude, longitude, type || 'military', region]);

    await query(`
      INSERT INTO checkpoint_status_history (checkpoint_id, status, reported_by)
      VALUES ($1, 'unknown', $2)
    `, [result.rows[0].id, req.user.id]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const cp = await query('SELECT id FROM checkpoints WHERE id=$1', [id]);
    if (!cp.rows[0]) return res.status(404).json({ error: 'Checkpoint not found' });

    const result = await query(`
      INSERT INTO checkpoint_status_history (checkpoint_id, status, notes, reported_by, verified_by)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [id, status, notes, req.user.id, req.user.role !== 'citizen' ? req.user.id : null]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.getStatusHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page, limit, offset } = paginate(req);

    const countResult = await query('SELECT COUNT(*) FROM checkpoint_status_history WHERE checkpoint_id=$1', [id]);
    const result = await query(`
      SELECT csh.*, u.username as reported_by_username, v.username as verified_by_username
      FROM checkpoint_status_history csh
      LEFT JOIN users u ON u.id = csh.reported_by
      LEFT JOIN users v ON v.id = csh.verified_by
      WHERE csh.checkpoint_id = $1
      ORDER BY csh.created_at DESC
      LIMIT $2 OFFSET $3
    `, [id, limit, offset]);

    res.json(paginatedResponse(result.rows, countResult.rows[0].count, page, limit));
  } catch (err) {
    next(err);
  }
};
