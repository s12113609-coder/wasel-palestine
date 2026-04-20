import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

export const options = {
  stages: [
    { duration: '10s', target: 5   },  // warm up
    { duration: '10s', target: 200 },  // spike!
    { duration: '30s', target: 200 },  // hold spike
    { duration: '10s', target: 5   },  // scale down
    { duration: '20s', target: 5   },  // recovery
    { duration: '10s', target: 0   },  // done
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // more lenient during spike
    errors: ['rate<0.15'],
  },
};

const BASE_URL = 'http://localhost:3000/api/v1';

export default function () {
  // Spike test focuses on the most-read endpoint
  const res = http.get(`${BASE_URL}/incidents?page=1&limit=20`);

  check(res, {
    'status 200': (r) => r.status === 200,
    'response < 2s': (r) => r.timings.duration < 2000,
  });

  errorRate.add(res.status !== 200);
  responseTime.add(res.timings.duration);

  sleep(0.1); // minimal sleep to maximize pressure
}
