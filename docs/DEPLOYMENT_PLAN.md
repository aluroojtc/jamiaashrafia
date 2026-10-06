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

---

## 6. Sign-in and Accounts (required after the October 2026 security upgrade)
The server now issues its own sessions (an HttpOnly cookie) and ignores identity sent by browsers. There is no shared default password and no offline sign-in.

1. **Deploy and restart** the Node server. The `auth_sessions` table and the `user_credentials.must_change` column are created automatically on start.
2. **New installation:** run `npm run bootstrap-admin` on the server. It creates the Super Admin and prints a one-time temporary password.
3. **Existing installation:** the old demo passwords (`admin123`, `nazim123`, `ashrafia123`) were published in the source code. Issue new ones to everyone:
   - `npm run issue-temp-passwords -- --dry-run --all` lists the accounts.
   - `npm run issue-temp-passwords -- --all` sets a random temporary password for each and writes them to `private/temp-passwords-<time>.csv` (never served by the web server, ignored by git).
   - Hand the passwords out through the Academic Office, then delete the CSV file.
   - Without `--all`, only accounts that have no password at all are covered.
4. **Lost Super Admin password:** `npm run bootstrap-admin` issues a new temporary password for the existing Super Admin (`--email` or `--id` picks one when there are several).
5. Everyone signing in with a temporary password must choose their own (at least 8 characters) before the portal opens.
6. **HTTPS:** serve the portal over HTTPS in production. Behind a proxy, forward `X-Forwarded-Proto: https` so the session cookie is marked `Secure`.
7. **Tests:** `npm run test:security` checks sign-in, sessions and record access rules against the database (it creates and removes its own test data).

---

## 7. Roles & Permissions (permission catalog upgrade)
Roles and their permissions now live in their own tables (`roles`, `role_permissions`, plus a read-only `permissions` mirror of the catalog in `server/permissions.js`). Security-relevant changes are written to `audit_log`.

1. **First start after the upgrade** imports the existing roles automatically, giving each the permissions that reproduce what it could already do. The old `system_settings` keys `roleDefinitions` and `rolePermissions` are left untouched as a backup and are no longer read.
2. **Data scope** belongs to each role: *Whole institution*, *Classes they teach*, or *Own records only*. Admin, Teacher and Student keep fixed scopes; custom roles choose one.
3. **Custom roles now get real powers** from the permissions ticked for them (previously they could only open pages). Review each custom role in Roles & Permissions after deploying.
4. **Admin no longer manages office-staff accounts** (accountants, custom roles) or anyone's role by default. Students and teachers are still managed by Admin. Give `users.*` permissions deliberately if needed.
5. **Audit log:** Super Admin can read it at `GET /api/audit` (a screen follows in a later phase).
6. Several server processes are supported: role changes reach every process within 15 seconds.

---

## 8. Multiple roles, Super Admin grants and role preview
1. **First start** creates `user_roles` (every account's main role is copied in) and `super_admins` (existing Super Admin accounts are copied in). It also adds two ready-made roles, *Examination Officer* and *Librarian*, and renames *Accountant / Donor* to *Finance Officer* unless it was renamed before. Deleting the ready-made roles later is respected.
2. **Additional roles:** a person can hold several roles (e.g. a teacher who also runs the library). Permissions add up; each permission keeps the widest data scope of the roles that grant it, so that teacher manages every loan but still marks only their own classes. Given on the Users page or the teacher's edit form, by staff with `users.assign_roles`.
3. **No one gains power by handing it out:** you can only give roles that cannot do more than you, only manage people who are not more powerful than you, and only edit roles that are not more powerful than you.
4. **Super Admin** is given or removed only with the crown button on the Users page, by a Super Admin who re-enters their password. There is always at least one. `npm run bootstrap-admin` still recovers access.
5. **Preview:** a Super Admin can open the portal as a role sees it (the eye button on Roles & Permissions). Nothing can be changed during a preview, and the browser discards anything typed when it ends. Every preview is in the audit log.
