const { query } = require('../config/database');
const { paginate, paginatedResponse } = require('../utils/pagination');

exports.subscribe = async(req, res, next) => {
    try {
        const { region, latitude, longitude, radius_km, categories } = req.body;

        if (!region && (!latitude || !longitude)) {
            return res.status(400).json({ error: 'Either region or coordinates (latitude+longitude) required' });
        }

        const result = await query(`
      INSERT INTO alert_subscriptions (user_id, region, latitude, longitude, radius_km, categories)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (user_id, region) DO UPDATE SET
        latitude=$3, longitude=$4, radius_km=$5, categories=$6, is_active=true
      RETURNING *
    `, [req.user.id, region || null, latitude || null, longitude || null, radius_km || 10, categories || []]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
};

exports.listSubscriptions = async(req, res, next) => {
    try {
        const result = await query(
            'SELECT * FROM alert_subscriptions WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
};

exports.deleteSubscription = async(req, res, next) => {
    try {
        const { id } = req.params;
        const result = await query(
            'DELETE FROM alert_subscriptions WHERE id=$1 AND user_id=$2 RETURNING id', [id, req.user.id]
        );
        if (!result.rows[0]) return res.status(404).json({ error: 'Subscription not found' });
        res.json({ message: 'Subscription deleted' });
    } catch (err) {
        next(err);
    }
};

exports.listAlerts = async(req, res, next) => {
    try {
        const { page, limit, offset } = paginate(req);
        const { unread_only } = req.query;

        const conditions = ['al.subscription_id IN (SELECT id FROM alert_subscriptions WHERE user_id=$1)'];
        const params = [req.user.id];
        let idx = 2;

        if (unread_only === 'true') { conditions.push(`al.is_read = false`); }

        const where = `WHERE ${conditions.join(' AND ')}`;
        const countResult = await query(`SELECT COUNT(*) FROM alerts al ${where}`, params);
        params.push(limit, offset);

        const result = await query(`
      SELECT al.*, i.title as incident_title, i.type as incident_type, i.severity as incident_severity
      FROM alerts al
      LEFT JOIN incidents i ON i.id = al.incident_id
      ${where}
      ORDER BY al.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `, params);

        res.json(paginatedResponse(result.rows, countResult.rows[0].count, page, limit));
    } catch (err) {
        next(err);
    }
};

exports.markRead = async(req, res, next) => {
    try {
        const { id } = req.params;
        await query(`
      UPDATE alerts SET is_read=true
      WHERE id=$1 AND subscription_id IN (
        SELECT id FROM alert_subscriptions WHERE user_id=$2
      )
    `, [id, req.user.id]);
        res.json({ message: 'Alert marked as read' });
    } catch (err) {
        next(err);
    }
};