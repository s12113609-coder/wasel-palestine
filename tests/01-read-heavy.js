import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m',  target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = 'http://localhost:3000/api/v1';

export default function () {
  // Test 1: List checkpoints
  let res = http.get(`${BASE_URL}/checkpoints`);
  check(res, { 'checkpoints 200': (r) => r.status === 200 });
  errorRate.add(res.status !== 200);
  responseTime.add(res.timings.duration);
  sleep(0.5);

  // Test 2: List incidents with filters
  res = http.get(`${BASE_URL}/incidents?status=verified&page=1&limit=20`);
  check(res, { 'incidents 200': (r) => r.status === 200 });
  errorRate.add(res.status !== 200);
  responseTime.add(res.timings.duration);
  sleep(0.5);

  // Test 3: List reports
  res = http.get(`${BASE_URL}/reports?page=1&limit=20`);
  check(res, { 'reports 200': (r) => r.status === 200 });
  errorRate.add(res.status !== 200);
  responseTime.add(res.timings.duration);
  sleep(0.5);

  // Test 4: Route estimate
  res = http.get(`${BASE_URL}/routes/estimate?from_lat=31.86&from_lng=35.23&to_lat=31.77&to_lng=35.23`);
  check(res, { 'route 200': (r) => r.status === 200 });
  errorRate.add(res.status !== 200);
  responseTime.add(res.timings.duration);
  sleep(1);
}
