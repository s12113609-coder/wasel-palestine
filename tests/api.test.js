const request = require('supertest');
const app = require('../src/app');

// ─── AUTH TESTS ───────────────────────────────────────────────────
describe('POST /api/v1/auth/register', () => {
  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: `testuser_${Date.now()}`,
        email: `test_${Date.now()}@wasel.ps`,
        password: 'Test@12345',
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user.role).toBe('citizen');
  });

  it('should reject weak password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'weakpw', email: 'weak@test.com', password: '123' });
    expect(res.status).toBe(422);
  });

  it('should reject invalid email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'testuser2', email: 'not-an-email', password: 'Valid@1234' });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/v1/auth/login', () => {
  it('should reject wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@wasel.ps', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────
describe('GET /health', () => {
  it('should return 200 OK', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ─── INCIDENTS ────────────────────────────────────────────────────
describe('GET /api/v1/incidents', () => {
  it('should return paginated list', async () => {
    const res = await request(app).get('/api/v1/incidents');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
  });

  it('should support filtering by status', async () => {
    const res = await request(app).get('/api/v1/incidents?status=active');
    expect(res.status).toBe(200);
    res.body.data.forEach(i => expect(i.status).toBe('active'));
  });

  it('should support pagination params', async () => {
    const res = await request(app).get('/api/v1/incidents?page=1&limit=5');
    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(5);
  });
});

describe('POST /api/v1/incidents', () => {
  it('should reject unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/v1/incidents')
      .send({ title: 'Test', type: 'closure' });
    expect(res.status).toBe(401);
  });
});

// ─── CHECKPOINTS ──────────────────────────────────────────────────
describe('GET /api/v1/checkpoints', () => {
  it('should return list of checkpoints', async () => {
    const res = await request(app).get('/api/v1/checkpoints');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });
});

// ─── REPORTS ──────────────────────────────────────────────────────
describe('POST /api/v1/reports', () => {
  it('should reject report with short description', async () => {
    const res = await request(app)
      .post('/api/v1/reports')
      .send({ latitude: 31.9, longitude: 35.2, category: 'delay', description: 'short' });
    expect(res.status).toBe(422);
  });

  it('should reject report with invalid coordinates', async () => {
    const res = await request(app)
      .post('/api/v1/reports')
      .send({ latitude: 999, longitude: 35.2, category: 'delay', description: 'Valid description here' });
    expect(res.status).toBe(422);
  });
});

// ─── ROUTE ESTIMATION ─────────────────────────────────────────────
describe('GET /api/v1/routes/estimate', () => {
  it('should require coordinates', async () => {
    const res = await request(app).get('/api/v1/routes/estimate');
    expect(res.status).toBe(422);
  });

  it('should return route estimate with valid coords', async () => {
    const res = await request(app)
      .get('/api/v1/routes/estimate?from_lat=31.9&from_lng=35.2&to_lat=32.1&to_lng=35.2');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('distance_km');
    expect(res.body).toHaveProperty('duration_minutes');
  });
});

// ─── 404 ──────────────────────────────────────────────────────────
describe('Unknown routes', () => {
  it('should return 404', async () => {
    const res = await request(app).get('/api/v1/nonexistent');
    expect(res.status).toBe(404);
  });
});
