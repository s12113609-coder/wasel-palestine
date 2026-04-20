const { query, withTransaction } = require('../config/database');
const { paginate, paginatedResponse } = require('../utils/pagination');

const DUPLICATE_DISTANCE_KM = 0.5;
const DUPLICATE_TIME_MINUTES = 30;

// Haversine distance in km
const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

exports.list = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req);
    const { status, category } = req.query;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (status) { conditions.push(`r.status = $${idx++}`); params.push(status); }
    if (category) { conditions.push(`r.category = $${idx++}`); params.push(category); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await query(`SELECT COUNT(*) FROM reports r ${where}`, params);
    params.push(limit, offset);

    const result = await query(`
      SELECT r.*,
        u.username as submitter_username,
        COALESCE(SUM(v.vote), 0) as vote_score,
        COUNT(v.id) as vote_count
      FROM reports r
      LEFT JOIN users u ON u.id = r.submitted_by
      LEFT JOIN report_votes v ON v.report_id = r.id
      ${where}
      GROUP BY r.id, u.username
      ORDER BY r.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `, params);

    res.json(paginatedResponse(result.rows, countResult.rows[0].count, page, limit));
  } catch (err) {
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT r.*, u.username as submitter_username,
        COALESCE(SUM(v.vote), 0) as vote_score
      FROM reports r
      LEFT JOIN users u ON u.id = r.submitted_by
      LEFT JOIN report_votes v ON v.report_id = r.id
      WHERE r.id = $1
      GROUP BY r.id, u.username
    `, [id]);

    if (!result.rows[0]) return res.status(404).json({ error: 'Report not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.submit = async (req, res, next) => {
  try {
    const { latitude, longitude, category, description } = req.body;
    const userId = req.user?.id || null;

    // Rate limit per user: max 5 reports per hour (raw query)
    if (userId) {
      const recentCount = await query(`
        SELECT COUNT(*) FROM reports
        WHERE submitted_by=$1 AND created_at > NOW() - INTERVAL '1 hour'
      `, [userId]);
      if (parseInt(recentCount.rows[0].count) >= 5) {
        return res.status(429).json({ error: 'Too many reports. Please wait before submitting again.' });
      }
    }

    // Duplicate detection: nearby reports of same category within 30min
    const recent = await query(`
      SELECT id, latitude, longitude FROM reports
      WHERE category = $1
        AND status != 'rejected'
        AND created_at > NOW() - INTERVAL '${DUPLICATE_TIME_MINUTES} minutes'
    `, [category]);

    let duplicateOf = null;
    for (const r of recent.rows) {
      const dist = haversine(latitude, longitude, parseFloat(r.latitude), parseFloat(r.longitude));
      if (dist <= DUPLICATE_DISTANCE_KM) {
        duplicateOf = r.id;
        break;
      }
    }

    const status = duplicateOf ? 'duplicate' : 'pending';
    const confidence = userId ? 0.6 : 0.3;

    const result = await query(`
      INSERT INTO reports (latitude, longitude, category, description, status, confidence_score, duplicate_of, submitted_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [latitude, longitude, category, description, status, confidence, duplicateOf, userId]);

    await query(`
      INSERT INTO report_audit_log (report_id, action, performed_by, notes)
      VALUES ($1, 'submitted', $2, $3)
    `, [result.rows[0].id, userId, duplicateOf ? `Marked as duplicate of ${duplicateOf}` : 'New report submitted']);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.vote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { vote } = req.body;
    if (![1, -1].includes(vote)) return res.status(400).json({ error: 'Vote must be 1 or -1' });

    const report = await query('SELECT id, submitted_by FROM reports WHERE id=$1', [id]);
    if (!report.rows[0]) return res.status(404).json({ error: 'Report not found' });
    if (report.rows[0].submitted_by === req.user.id) {
      return res.status(403).json({ error: 'Cannot vote on your own report' });
    }

    await query(`
      INSERT INTO report_votes (report_id, user_id, vote) VALUES ($1,$2,$3)
      ON CONFLICT (report_id, user_id) DO UPDATE SET vote=$3
    `, [id, req.user.id, vote]);

    // Update confidence score based on votes
    const votes = await query('SELECT SUM(vote) as score, COUNT(*) as total FROM report_votes WHERE report_id=$1', [id]);
    const { score, total } = votes.rows[0];
    const confidence = Math.min(1, Math.max(0, (parseFloat(score) + parseFloat(total)) / (2 * parseFloat(total))));

    await query('UPDATE reports SET confidence_score=$1 WHERE id=$2', [confidence.toFixed(2), id]);

    res.json({ message: 'Vote recorded', confidence: confidence.toFixed(2) });
  } catch (err) {
    next(err);
  }
};

exports.moderate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, moderation_note } = req.body;

    const allowed = ['verified', 'rejected', 'duplicate'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${allowed.join(', ')}` });
    }

    const result = await query(`
      UPDATE reports SET
        status=$1, moderation_note=$2, moderated_by=$3, updated_at=NOW()
      WHERE id=$4 RETURNING *
    `, [status, moderation_note, req.user.id, id]);

    if (!result.rows[0]) return res.status(404).json({ error: 'Report not found' });

    await query(`
      INSERT INTO report_audit_log (report_id, action, performed_by, notes)
      VALUES ($1, $2, $3, $4)
    `, [id, `moderated_${status}`, req.user.id, moderation_note]);

    // Reward reputation if report verified
    if (status === 'verified' && result.rows[0].submitted_by) {
      await query('UPDATE users SET reputation_score = reputation_score + 10 WHERE id=$1', [result.rows[0].submitted_by]);
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};
