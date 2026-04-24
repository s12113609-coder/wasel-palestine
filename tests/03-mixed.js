import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const readTime = new Trend('read_response_time');
const writeTime = new Trend('write_response_time');

export const options = {
    scenarios: {
        readers: {
            executor: 'constant-vus',
            vus: 30,
            duration: '2m',
            exec: 'readScenario',
        },
        writers: {
            executor: 'constant-vus',
            vus: 15,
            duration: '2m',
            exec: 'writeScenario',
        },
    },
    thresholds: {
        http_req_duration: ['p(95)<800'],
        errors: ['rate<0.08'],
    },
};

const BASE_URL = 'http://localhost:3000/api/v1';

export function readScenario() {
    const endpoints = [
        `${BASE_URL}/checkpoints`,
        `${BASE_URL}/incidents?page=1&limit=10`,
        `${BASE_URL}/reports?page=1&limit=10`,
        `${BASE_URL}/routes/estimate?from_lat=31.86&from_lng=35.23&to_lat=31.77&to_lng=35.23`,
    ];

    const url = endpoints[Math.floor(Math.random() * endpoints.length)];
    const res = http.get(url);

    check(res, { 'read ok': (r) => r.status === 200 });
    errorRate.add(res.status !== 200);
    readTime.add(res.timings.duration);
    sleep(0.5);
}

export function writeScenario() {
    const lat = 31.5 + Math.random() * 1.5;
    const lng = 35.0 + Math.random() * 0.8;

    const payload = JSON.stringify({
        category: 'delay',
        description: `Mixed test report at ${lat.toFixed(4)},${lng.toFixed(4)} - VU${__VU}`,
        latitude: lat,
        longitude: lng,
    });

    const res = http.post(`${BASE_URL}/reports`, payload, {
        headers: { 'Content-Type': 'application/json' },
    });

    check(res, { 'write ok': (r) => r.status === 201 || r.status === 200 });
    errorRate.add(res.status >= 400);
    writeTime.add(res.timings.duration);
    sleep(1.5);
}