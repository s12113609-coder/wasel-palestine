import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const successfulSubmits = new Counter('successful_submits');

export const options = {
    stages: [
        { duration: '20s', target: 20 },
        { duration: '1m', target: 50 },
        { duration: '20s', target: 0 },
    ],
    thresholds: {
        http_req_duration: ['p(95)<1000'],
        errors: ['rate<0.1'],
    },
};

const BASE_URL = 'http://localhost:3000/api/v1';

// Different report data to avoid duplicate detection
const categories = [
    'checkpoint_closure',
    'delay',
    'road_damage',
    'hazard',
    'protest',
    'military',
    'other',
];

const locations = [
    { lat: 31.8633, lng: 35.2313 },
    { lat: 32.1731, lng: 35.2719 },
    { lat: 31.7057, lng: 35.1922 },
    { lat: 31.9026, lng: 35.2034 },
    { lat: 32.2206, lng: 35.2131 },
];

export default function() {
    const loc = locations[Math.floor(Math.random() * locations.length)];
    const category = categories[Math.floor(Math.random() * categories.length)];

    // Add small random offset to avoid duplicate detection
    const lat = loc.lat + (Math.random() - 0.5) * 0.1;
    const lng = loc.lng + (Math.random() - 0.5) * 0.1;

    const payload = JSON.stringify({
        category,
        description: `Test report: ${category} at location ${lat.toFixed(4)},${lng.toFixed(4)} - VU ${__VU} iter ${__ITER}`,
        latitude: lat,
        longitude: lng,
    });

    const headers = { 'Content-Type': 'application/json' };

    const res = http.post(`${BASE_URL}/reports`, payload, { headers });

    const success = check(res, {
        'report submitted': (r) => r.status === 201 || r.status === 200,
        'has id': (r) => {
            try { return JSON.parse(r.body).id !== undefined; } catch { return false; }
        },
    });

    if (success) successfulSubmits.add(1);
    errorRate.add(res.status >= 400);
    responseTime.add(res.timings.duration);

    sleep(1);
}