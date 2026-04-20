const { query } = require('../config/database');

const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

const triggerAlerts = async (incident) => {
  try {
    const subscriptions = await query(`
      SELECT * FROM alert_subscriptions WHERE is_active = true
    `);

    for (const sub of subscriptions.rows) {
      let matches = false;

      // Match by region
      if (sub.region && incident.region && incident.region.toLowerCase().includes(sub.region.toLowerCase())) {
        matches = true;
      }

      // Match by geo radius
      if (!matches && sub.latitude && sub.longitude && incident.latitude && incident.longitude) {
        const dist = haversine(
          parseFloat(sub.latitude), parseFloat(sub.longitude),
          parseFloat(incident.latitude), parseFloat(incident.longitude)
        );
        if (dist <= parseFloat(sub.radius_km)) matches = true;
      }

      // Match by category
      if (matches && sub.categories && sub.categories.length > 0) {
        if (!sub.categories.includes(incident.type)) matches = false;
      }

      if (matches) {
        await query(`
          INSERT INTO alerts (subscription_id, incident_id, message)
          VALUES ($1, $2, $3)
        `, [
          sub.id,
          incident.id,
          `⚠️ New ${incident.severity} ${incident.type} incident in ${incident.region || 'your area'}: ${incident.title}`
        ]);
      }
    }
  } catch (err) {
    console.error('Alert trigger error:', err.message);
  }
};

module.exports = { triggerAlerts };
