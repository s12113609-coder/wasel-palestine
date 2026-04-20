import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Custom metrics
const errorRate = new Rate('errors');
const incidentListDuration = new Trend('incident_list_duration');
const reportSubmitDuration = new Trend('report_submit_duration');

// ─── TEST SCENARIOS ────────────────────────────────────────────────
export const options = {
  scenarios: {
    // 1. Read-heavy workload
    read_heavy: {
      executor: 'constant-vus',
      vus: 50,
      duration: '1m',
      tags: { scenario: 'read_heavy' },
      exec: 'readHeavy',
    },
    // 2. Write-heavy workload
    write_heavy: {
      executor: 'constant-vus',
      vus: 20,
      duration: '1m',
      startTime: '70s',
      tags: { scenario: 'write_heavy' },
      exec: 'writeHeavy',
    },
    // 3. Mixed workload
    mixed: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 30 },
        { duration: '1m', target: 30 },
        { duration: '30s', target: 0 },
      ],
      startTime: '140s',
      tags: { scenario: 'mixed' },
      exec: 'mixed',
    },
    // 4. Spike test
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 5 },
        { duration: '10s', target: 200 },  // spike
        { duration: '10s', target: 5 },
      ],
      startTime: '280s',
      tags: { scenario: 'spike' },
      exec: 'readHeavy',
    },
    // 5. Soak test
    soak: {
      executor: 'constant-vus',
      vus: 10,
      duration: '5m',
      startTime: '320s',
      tags: { scenario: 'soak' },
      exec: 'mixed',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.05'],
  },
};

// ─── SETUP: get auth token ─────────────────────────────────────────
export function setup() {
  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: 'admin@wasel.ps', password: 'Admin@2026' }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (loginRes.status !== 200) {
    console.warn('Login failed in setup, tests will run unauthenticated');
    return { token: null };
  }
  return { token: loginRes.json('accessToken') };
}

const authHeaders = (token) => ({
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
});

// ─── SCENARIO 1: Read-heavy ────────────────────────────────────────
export function readHeavy(data) {
  group('Read Incidents', () => {
    const r1 = http.get(`${BASE_URL}/api/v1/incidents?page=1&limit=20`);
    incidentListDuration.add(r1.timings.duration);
    errorRate.add(!check(r1, { 'incidents 200': (r) => r.status === 200 }));
  });

  group('Read Checkpoints', () => {
    const r2 = http.get(`${BASE_URL}/api/v1/checkpoints`);
    errorRate.add(!check(r2, { 'checkpoints 200': (r) => r.status === 200 }));
  });

  group('Filter Incidents', () => {
    const r3 = http.get(`${BASE_URL}/api/v1/incidents?status=active&severity=high`);
    errorRate.add(!check(r3, { 'filter 200': (r) => r.status === 200 }));
  });

  group('Route Estimate', () => {
    const r4 = http.get(`${BASE_URL}/api/v1/routes/estimate?from_lat=31.9&from_lng=35.2&to_lat=32.1&to_lng=35.25`);
    errorRate.add(!check(r4, { 'route 200': (r) => r.status === 200 }));
  });

  sleep(1);
}

// ─── SCENARIO 2: Write-heavy ───────────────────────────────────────
export function writeHeavy(data) {
  const ts = Date.now();

  group('Submit Report', () => {
    const r = http.post(`${BASE_URL}/api/v1/reports`,
      JSON.stringify({
        latitude: 31.8 + Math.random() * 0.3,
        longitude: 35.1 + Math.random() * 0.3,
        category: ['delay', 'road_damage', 'checkpoint_closure', 'hazard'][Math.floor(Math.random() * 4)],
        description: `Load test report submitted at ${ts} - automated test submission`,
      }),
      authHeaders(data.token)
    );
    reportSubmitDuration.add(r.timings.duration);
    errorRate.add(!check(r, {
      'report created or rate limited': (r) => r.status === 201 || r.status === 429,
    }));
  });

  sleep(2);
}

// ─── SCENARIO 3: Mixed ────────────────────────────────────────────
export function mixed(data) {
  const roll = Math.random();

  if (roll < 0.6) {
    // 60% reads
    const r = http.get(`${BASE_URL}/api/v1/incidents?page=${Math.ceil(Math.random() * 3)}`);
    errorRate.add(!check(r, { 'mixed read 200': (r) => r.status === 200 }));
  } else if (roll < 0.85) {
    // 25% report reads
    const r = http.get(`${BASE_URL}/api/v1/reports?status=pending`);
    errorRate.add(!check(r, { 'reports read 200': (r) => r.status === 200 }));
  } else {
    // 15% writes
    const r = http.post(`${BASE_URL}/api/v1/reports`,
      JSON.stringify({
        latitude: 31.9,
        longitude: 35.2,
        category: 'delay',
        description: 'Mixed workload test report submission for performance evaluation',
      }),
      authHeaders(data.token)
    );
    errorRate.add(!check(r, {
      'mixed write ok': (r) => r.status === 201 || r.status === 429,
    }));
  }

  sleep(0.5 + Math.random());
}
