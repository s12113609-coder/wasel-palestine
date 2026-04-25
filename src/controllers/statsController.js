const knex = require('../config/knex');


exports.overview = async(req, res, next) => {
    try {
        const [incidents, reports, checkpoints, users] = await Promise.all([
            knex('incidents').count('id as count').first(),
            knex('reports').count('id as count').first(),
            knex('checkpoints').where({ is_active: true }).count('id as count').first(),
            knex('users').where({ is_active: true }).count('id as count').first(),
        ]);

        const bySeverity = await knex('incidents')
            .select('severity')
            .count('id as count')
            .groupBy('severity')
            .orderBy('count', 'desc');

        const byType = await knex('incidents')
            .select('type')
            .count('id as count')
            .groupBy('type')
            .orderBy('count', 'desc');

        res.json({
            totals: {
                incidents: parseInt(incidents.count),
                reports: parseInt(reports.count),
                checkpoints: parseInt(checkpoints.count),
                active_users: parseInt(users.count),
            },
            incidents_by_severity: bySeverity,
            incidents_by_type: byType,
        });
    } catch (err) {
        next(err);
    }
};


exports.checkpointStats = async(req, res, next) => {
    try {
        const byRegion = await knex('checkpoints')
            .select('region')
            .count('id as count')
            .where({ is_active: true })
            .groupBy('region')
            .orderBy('count', 'desc');

        const byType = await knex('checkpoints')
            .select('type')
            .count('id as count')
            .where({ is_active: true })
            .groupBy('type')
            .orderBy('count', 'desc');

        const recentUpdates = await knex('checkpoint_status_history as csh')
            .join('checkpoints as c', 'c.id', 'csh.checkpoint_id')
            .select('c.name', 'c.region', 'csh.status', 'csh.created_at')
            .orderBy('csh.created_at', 'desc')
            .limit(10);

        res.json({
            by_region: byRegion,
            by_type: byType,
            recent_updates: recentUpdates,
        });
    } catch (err) {
        next(err);
    }
};

exports.reportStats = async(req, res, next) => {
    try {
        const byCategory = await knex('reports')
            .select('category')
            .count('id as count')
            .groupBy('category')
            .orderBy('count', 'desc');

        const byStatus = await knex('reports')
            .select('status')
            .count('id as count')
            .groupBy('status')
            .orderBy('count', 'desc');

        const topContributors = await knex('reports as r')
            .join('users as u', 'u.id', 'r.submitted_by')
            .select('u.username', 'u.reputation_score')
            .count('r.id as report_count')
            .whereNotNull('r.submitted_by')
            .groupBy('u.id', 'u.username', 'u.reputation_score')
            .orderBy('report_count', 'desc')
            .limit(10);

        res.json({
            by_category: byCategory,
            by_status: byStatus,
            top_contributors: topContributors,
        });
    } catch (err) {
        next(err);
    }
};