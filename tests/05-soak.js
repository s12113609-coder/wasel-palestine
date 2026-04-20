import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const totalRequests = new Counter('total_requests');

export const options = {
  stages: [
    { duration: '2m',  target: 30 }, // ramp up
    { duration: '20m', target: 30 }, // sustained load
    { duration: '2m',  target: 0  }, // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<600'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = 'http://localhost:3000/api/v1';

export default function () {
  // Rotate through all endpoints to simulate real usage
  const iter = __ITER % 4;

  let res;

  if (iter === 0) {
    res = http.get(`${BASE_URL}/checkpoints`);
    check(res, { 'checkpoints ok': (r) => r.status === 200 });
  } else if (iter === 1) {
    res = http.get(`${BASE_URL}/incidents?page=1&limit=20`);
    check(res, { 'incidents ok': (r) => r.status === 200 });
  } else if (iter === 2) {
    res = http.get(`${BASE_URL}/reports?page=1&limit=20`);
    check(res, { 'reports ok': (r) => r.status === 200 });
  } else {
    const lat = 31.5 + Math.random() * 1.5;
    const lng = 35.0 + Math.random() * 0.8;
    res = http.post(
      `${BASE_URL}/reports`,
      JSON.stringify({
        category: 'other',
        description: `Soak test report VU${__VU} iter${__ITER} at ${lat.toFixed(4)},${lng.toFixed(4)}`,
        latitude: lat,
        longitude: lng,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    check(res, { 'submit ok': (r) => r.status === 201 || r.status === 200 });
  }

  errorRate.add(res.status >= 400);
  responseTime.add(res.timings.duration);
  totalRequests.add(1);

  sleep(1);
}
