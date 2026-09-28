# Jamia Ashrafia Lahore - LMS Cloud Deployment Plan

## 1. Overview
This deployment plan defines production-ready procedures for provisioning, deploying, and maintaining the Cloud LMS for Jamia Ashrafia across high-availability cloud infrastructure (AWS / GCP / Bare Metal / Local Laragon Staging).

---

## 2. Infrastructure Specification

| Component | Production Recommendation | Staging / Local (Laragon) |
|---|---|---|
| **Compute** | 3x AWS t3.xlarge (16GB RAM, 4 vCPU) behind ALB | Localhost / Apache / Node.js 20 |
| **Database** | AWS RDS PostgreSQL 16 (Multi-AZ, db.t3.large) | Local PostgreSQL / MySQL 8.0 |
| **Cache & Pub/Sub** | AWS ElastiCache Redis (Cluster mode) | Local Redis 7 |
| **Object Storage** | AWS S3 Bucket (SSE-KMS encrypted) | Local assets directory / MinIO |
| **Media SFU** | 2x LiveKit SFU instances on EC2 (c5.xlarge) | Local WebRTC peer connection |
| **Reverse Proxy / SSL** | Nginx 1.25 with Let's Encrypt Wildcard SSL | Nginx / Apache in Laragon |

---

## 3. Containerized Deployment (Docker Compose)

```yaml
version: '3.8'

services:
  app:
    build: .
    container_name: jamia_ashrafia_lms
    restart: always
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=postgresql://ashrafia_user:${DB_PASSWORD}@postgres:5432/jamia_ashrafia_lms
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - S3_BUCKET=jamia-ashrafia-storage
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16-alpine
    container_name: ashrafia_postgres
    restart: always
    environment:
      POSTGRES_USER: ashrafia_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: jamia_ashrafia_lms
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./database/schema.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    container_name: ashrafia_redis
    restart: always
    volumes:
      - redisdata:/data

  nginx:
    image: nginx:alpine
    container_name: ashrafia_proxy
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./deploy/nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - app

volumes:
  pgdata:
  redisdata:
```

---

## 4. CI/CD Pipeline (GitHub Actions)
1. **Lint & Security Scan:** Runs `npm audit`, OWASP dependency checks, and SonarQube linter.
2. **Automated Unit & Integration Tests:** Validates RBAC permissions, fee calculation, Wifaq grade conversion, and admission workflows.
3. **Build & Push:** Compiles assets and builds immutable Docker container images tagged with commit SHA.
4. **Blue/Green Deployment:** Zero-downtime traffic shift using AWS Target Group weights or Kubernetes Rolling Updates.

---

## 5. Backup & Disaster Recovery (DR) Plan
- **RPO (Recovery Point Objective):** < 15 minutes (automated write-ahead log shipping to off-site S3).
- **RTO (Recovery Time Objective):** < 30 minutes (automated container restart / terraform rollback).
- **Daily Automated Dumps:** Cron job executes `pg_dump` every night at 02:00 PKT (low traffic after Isha prayer), compressed with GPG encryption, and synced to geo-redundant storage.
- **Failover Routine:** Semi-annual simulated disaster drill restoring backups onto isolated staging clusters.
