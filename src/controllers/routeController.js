const axios = require('axios');
const { query } = require('../config/database');
const { cacheGet, cacheSet } = require('../config/redis');

const ORS_BASE = 'https://api.openrouteservice.org/v2';

// Fallback heuristic if ORS is unavailable
const heuristicRoute = (fromLat, fromLng, toLat, toLng, incidents, checkpoints) => {
  const R = 6371;
  const dLat = (toLat - fromLat) * Math.PI / 180;
  const dLon = (toLng - fromLng) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(fromLat*Math.PI/180)*Math.cos(toLat*Math.PI/180)*Math.sin(dLon/2)**2;
  const straightLine = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  const estimatedDistance = straightLine * 1.3; // Road factor
  let baseSpeed = 60; // km/h

  // Adjust for active incidents
  const affectingIncidents = incidents.filter(inc => {
    const dist = Math.sqrt(Math.pow(inc.latitude - fromLat, 2) + Math.pow(inc.longitude - fromLng, 2));
    return dist < 0.5;
  });

  const closedCheckpoints = checkpoints.filter(cp => cp.current_status === 'closed');
  const delayMinutes = affectingIncidents.reduce((acc, inc) => {
    if (inc.severity === 'critical') return acc + 60;
    if (inc.severity === 'high') return acc + 30;
    if (inc.severity === 'medium') return acc + 15;
    return acc + 5;
  }, 0);

  const durationHours = estimatedDistance / baseSpeed;
  const totalDuration = Math.round(durationHours * 60) + delayMinutes;

  return {
    source: 'heuristic',
    distance_km: estimatedDistance.toFixed(2),
    duration_minutes: totalDuration,
    affecting_incidents: affectingIncidents.map(i => ({ id: i.id, type: i.type, severity: i.severity })),
    closed_checkpoints_nearby: closedCheckpoints.length,
    metadata: {
      note: 'Heuristic estimate. Real-time routing unavailable.',
      delay_minutes_from_incidents: delayMinutes,
    }
  };
};

exports.estimate = async (req, res, next) => {
  try {
    const { from_lat, from_lng, to_lat, to_lng, avoid_checkpoints, avoid_regions } = req.query;

    if (!from_lat || !from_lng || !to_lat || !to_lng) {
      return res.status(400).json({ error: 'from_lat, from_lng, to_lat, to_lng are required' });
    }

    const cacheKey = `route:${from_lat},${from_lng}->${to_lat},${to_lng}:${avoid_checkpoints}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    // Get active incidents for context
    const incidents = await query(`
      SELECT id, type, severity, latitude, longitude, title
      FROM incidents WHERE status IN ('active','verified')
      AND latitude IS NOT NULL
    `);

    const checkpoints = await query(`
      SELECT c.id, c.name, c.latitude, c.longitude,
        (SELECT status FROM checkpoint_status_history WHERE checkpoint_id=c.id ORDER BY created_at DESC LIMIT 1) as current_status
      FROM checkpoints c WHERE c.is_active = true
    `);

    // Try OpenRouteService
    let routeData = null;
    if (process.env.OPENROUTESERVICE_API_KEY && process.env.OPENROUTESERVICE_API_KEY !== 'your_openrouteservice_key_here') {
      try {
        const avoidPolygons = avoid_checkpoints === 'true'
          ? checkpoints.rows.filter(cp => cp.current_status === 'closed').map(cp => ({
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [[[cp.longitude - 0.005, cp.latitude - 0.005], [cp.longitude + 0.005, cp.latitude - 0.005], [cp.longitude + 0.005, cp.latitude + 0.005], [cp.longitude - 0.005, cp.latitude + 0.005], [cp.longitude - 0.005, cp.latitude - 0.005]]]
              }
            }))
          : [];

        const body = {
          coordinates: [[parseFloat(from_lng), parseFloat(from_lat)], [parseFloat(to_lng), parseFloat(to_lat)]],
        };
        if (avoidPolygons.length > 0) {
          body.options = { avoid_polygons: { type: 'FeatureCollection', features: avoidPolygons } };
        }

        const orsRes = await axios.post(`${ORS_BASE}/directions/driving-car/json`, body, {
          headers: { Authorization: process.env.OPENROUTESERVICE_API_KEY },
          timeout: 5000,
        });

        const route = orsRes.data.routes[0].summary;
        routeData = {
          source: 'openrouteservice',
          distance_km: (route.distance / 1000).toFixed(2),
          duration_minutes: Math.round(route.duration / 60),
          affecting_incidents: incidents.rows.slice(0, 5),
          metadata: { provider: 'OpenRouteService' }
        };
      } catch (orsErr) {
        console.warn('ORS unavailable, falling back to heuristic:', orsErr.message);
      }
    }

    if (!routeData) {
      routeData = heuristicRoute(
        parseFloat(from_lat), parseFloat(from_lng),
        parseFloat(to_lat), parseFloat(to_lng),
        incidents.rows, checkpoints.rows
      );
    }

    // Enrich with weather if available
    let weather = null;
    if (process.env.OPENWEATHER_API_KEY && process.env.OPENWEATHER_API_KEY !== 'your_openweather_key_here') {
      try {
        const weatherRes = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
          params: { lat: from_lat, lon: from_lng, appid: process.env.OPENWEATHER_API_KEY, units: 'metric' },
          timeout: 3000,
        });
        weather = {
          condition: weatherRes.data.weather[0].description,
          temperature_c: weatherRes.data.main.temp,
          wind_speed: weatherRes.data.wind.speed,
        };
        if (weatherRes.data.weather[0].main === 'Rain' || weatherRes.data.weather[0].main === 'Snow') {
          routeData.duration_minutes = Math.round(routeData.duration_minutes * 1.2);
          routeData.metadata.weather_adjustment = '+20% for adverse weather';
        }
      } catch {
        // weather optional
      }
    }

    const response = { ...routeData, weather };
    await cacheSet(cacheKey, response, 180);
    res.json(response);
  } catch (err) {
    next(err);
  }
};
