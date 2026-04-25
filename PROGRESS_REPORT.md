# Progress Report – Wasel Palestine

**Course:** Advanced Software Engineering – Spring 2026  
**Instructor:** Dr. Amjad AbuHassan  

---

## Team Members & Contributions

### 1. الين هيثم صدقي ياسين

**Role:** Backend Lead & DevOps  

- Project architecture design and technology stack selection
- Docker & Docker Compose setup (app + PostgreSQL + Redis)
- JWT Authentication system (access + refresh tokens, rotation, bcrypt)
- Redis caching layer (incidents, checkpoints, routes)
- Rate limiting, Helmet security, CORS configuration
- k6 performance testing (5 scenarios)
- GitHub Wiki documentation (7 pages)
- Postman collection documentation

### 2. ابراهيم عوض

**Role:** Database & API Developer  

- PostgreSQL database schema design (10 tables, ERD)
- Database migrations and seed scripts
- Checkpoint Management API (CRUD + status history)
- Incident Management API (CRUD + audit log + verify/close workflow)
- Database indexes for performance optimization
- Raw SQL complex queries (joins, pagination, filtering)

### 3. منار عيد

**Role:** Features Developer  

- Crowdsourced Reports API (submit, list, get)
- Duplicate detection system (Haversine formula, 0.5km / 30-min window)
- Community voting system (+1/-1, confidence score updates)
- Moderation workflow (verify/reject/duplicate + audit log)
- Report audit logging

### 4. يقين بزور

**Role:** Integrations & Intelligence  

- Route Estimation API (distance, duration, metadata)
- OpenRouteService integration (with timeout, caching, fallback)
- OpenWeatherMap integration (+20% penalty for rain/snow)
- Haversine heuristic fallback for route estimation
- Alert Subscriptions system (region + geo-radius + categories)
- Auto-trigger alerts on verified incidents
- Knex.js ORM integration (stats endpoints)

---

## Implemented Features

| # | Feature | Developer | Status |
|---|---------|-----------|--------|
| 1 | JWT Authentication (access + refresh tokens) | الين ياسين | ✅ Complete |
| 2 | Checkpoint Management + Status History | ابراهيم عوض | ✅ Complete |
| 3 | Incident Management + Audit Log | ابراهيم عوض | ✅ Complete |
| 4 | Database Schema Design (ERD, 10 tables) | ابراهيم عوض | ✅ Complete |
| 5 | Database Migrations + Seed Scripts | ابراهيم عوض | ✅ Complete |
| 6 | Database Indexes + Query Optimization | ابراهيم عوض | ✅ Complete |
| 7 | Crowdsourced Reports + Duplicate Detection | منار عيد | ✅ Complete |
| 8 | Community Voting + Confidence Scoring | منار عيد | ✅ Complete |
| 9 | Moderation Workflow + Audit Log | منار عيد | ✅ Complete |
| 10 | Route Estimation + ORS Integration | يقين بزور | ✅ Complete |
| 11 | OpenWeatherMap Integration | يقين بزور | ✅ Complete |
| 12 | Alert Subscriptions + Auto-trigger | يقين بزور | ✅ Complete |
| 13 | Redis Caching | الين ياسين | ✅ Complete |
| 14 | Knex.js ORM (Stats endpoints) | الين ياسين | ✅ Complete |
| 15 | Docker Compose Deployment | الين ياسين | ✅ Complete |
| 16 | Rate Limiting + Security | الين ياسين | ✅ Complete |
| 17 | k6 Performance Testing (5 scenarios) | الين ياسين | ✅ Complete |
| 18 | GitHub Wiki + Documentation | الين ياسين | ✅ Complete |

---

## Architecture Decisions

### Why Node.js + Express?

Node's non-blocking I/O is ideal for concurrent external API calls (ORS + OpenWeatherMap). Lower memory footprint than Spring Boot, faster iteration than Django.

### Why PostgreSQL?

Mobility data is highly relational. ACID compliance critical for audit logs. Native geospatial index support.

### Why Raw SQL + Knex (dual approach)?

Complex multi-join queries use raw SQL for performance. Simple aggregations use Knex for readability. Mirrors real-world practice.

---

## Challenges Faced

1. **External API reliability** — ORS sometimes unavailable → Haversine heuristic fallback
2. **Duplicate report detection** — Haversine distance check (0.5km, 30-min window)
3. **Cache invalidation** — Incident cache cleared on every write
4. **Refresh token security** — Stored as SHA-256 hash, rotated on every use
5. **Performance under load** — Connection pool tuning (max 50) resolved timeout errors

---

## Performance Results

| Scenario | Avg Response | p95 Latency | Throughput | Error Rate |
|----------|-------------|-------------|------------|------------|
| Read-heavy | 7.8ms | 13.67ms | 88.97 req/s | 0.00% ✓ |
| Write-heavy | 26.41ms | 47.43ms | 27.05 req/s | 0.00% ✓ |
| Mixed | 14.64ms | 37.43ms | 67.85 req/s | 0.00% ✓ |
| Spike (200 VUs) | 12.22ms | 41.43ms | 809.88 req/s | 84.63%* |
| Soak (24 min) | 25.21ms | 70.04ms | 26.84 req/s | 0.00% ✓ |

*Spike errors expected — rate limiter protects system under extreme load.
