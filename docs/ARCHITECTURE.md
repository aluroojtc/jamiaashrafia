# Jamia Ashrafia Lahore - Cloud LMS Architecture

## 1. Executive Summary & Institutional Context
Founded on **14 September 1947** by the esteemed scholar **Mufti Muhammad Hassan Amritsari** and named in honor of **Hazrat Maulana Ashraf Ali Thanwi**, **Jamia Ashrafia Lahore** is one of the Muslim world's premier centers of Islamic scholarship. From its original three-storied campus in Nila Gumbad Anarkali, it expanded in 1955 to a historic 120-kanal campus between Canal Road and Ferozepur Road in Lahore, inaugurated under muhaddith **Maulana Muhammad Idris Kandhlawi**. Today, it encompasses 12 major branches (including Madrisatul Faisal Lil Bannat in Model Town, Mahad al-Quba in Johar Town, and regional campuses) serving thousands of scholars, Huffaz, and Muftis across Pakistan and worldwide.

This Cloud Learning Management System (LMS) modernizes Jamia Ashrafia's academic infrastructure while preserving its traditional pedagogical excellence and Wifaq ul Madaris al-Arabia standards.

---

## 2. High-Level System Architecture Diagram

```
                              +-------------------------------------------+
                              |         Cloudflare Edge / DDoS / CDN       |
                              +-------------------------------------------+
                                                    |
                                         (HTTPS / WSS Terminated)
                                                    v
                              +-------------------------------------------+
                              |         Nginx / Traefik Reverse Proxy     |
                              +-------------------------------------------+
                                                    |
                                   +----------------+----------------+
                                   |                                 |
                                   v                                 v
                     +---------------------------+     +---------------------------+
                     |    LMS Web App Service    |     |    WebRTC SFU Media Server|
                     |  (Node.js / Express / API)|     |  (LiveKit / Mediasoup)    |
                     +---------------------------+     +---------------------------+
                        |           |           |                    |
                        |           |           |                    | (Real-time Video/Audio)
                        v           v           v                    v
              +-------------+ +-------------+ +-------------+  +--------------------+
              | PostgreSQL  | | Redis Cache | | S3 / MinIO  |  | Virtual Classrooms |
              | Relational  | | & Realtime  | | Document &  |  | Interactive White- |
              | Core DB     | | Pub/Sub     | | Media Store |  | board / Screen-    |
              +-------------+ +-------------+ +-------------+  | sharing WebRTC     |
                                                               +--------------------+
```

---

## 3. Core Architectural Components

### 3.1. Client Layer (Responsive Web Portal)
- **Design Philosophy:** Tailored Islamic academic aesthetic featuring deep Islamic teal (`#42939f` / `#124855`), antique gold/ochre accents (`#c0a264` / `#aa8637`), clean high-contrast light surface elevation, bilingual support (English & Nastaliq Urdu), and modern institutional branding.
- **Role-Based Views:**
  - **Super Admin (Mohtamim / Executive Shura):** Institutional KPI dashboards, branch management, financial audits, governance.
  - **Academic Admin (Nazim-e-Taleemat):** Admissions review & enrollment, course curricula, teacher allocations, timetables, examinations & Wifaq grade processing.
  - **Teacher (Sheikh-ul-Hadith / Asatizah):** Assigned classes, daily attendance, homework/assignment grading suites, live virtual classrooms, library reservations.
  - **Student (Talib-e-Ilm):** Enrolled classes, homework submission, live Zoom-like classes, digital fee challans, exam submissions, library search.
  - **Accountant (Nazim-e-Maliyat / Donor):** Tuition & hostel challan processing, Zakat & Sadaqah funds ledger, tax-deductible donation receipts, Kafalat-e-Talib-e-Ilm sponsorships.

### 3.2. Application & API Layer
- **Stateless Micro-Services / Modular Monolith:**
  - `Admissions Service`: Multi-stage application pipeline, B-Form/CNIC duplicate checks, interview scheduling, automated roll number generator.
  - `Academic & Timetable Service`: Complex constraint solving for classroom allocations, prayer-synchronized lecture slots (Fajr dars, Zuhr/Qailulah interval).
  - `Grading & Wifaq Results Engine`: Wifaq grading scale calculation (Mumtaz, Jayyid Jiddan, Jayyid, Maqbool, Rasib), digital sanad watermark generator.
  - `Fee & Donations Ledger`: Cryptographically verified Challan tracking, 100% scholarship waiver verification, Zakat eligibility rules engine.
  - `Maktaba Ashrafia Library Service`: ISBN/Accession tracking, OPAC search, digital manuscript viewer.

### 3.3. Zoom-Like Virtual Classroom (WebRTC SFU Architecture)
- Built on Selective Forwarding Unit (SFU) architecture (e.g. LiveKit or Mediasoup) providing:
  - Low-latency interactive HD audio & video streams.
  - Adaptive Bitrate (ABR) catering to varied network bandwidth across Pakistani rural/urban madrasa campuses.
  - Real-time HTML5 Canvas Whiteboard synchronized over WebSockets with dual Arabic script calligraphy support.
  - Client screen-sharing via `navigator.mediaDevices.getDisplayMedia`.
  - In-meeting moderated text chat with raised-hand queue.

### 3.4. Storage & Persistence Layer
- **PostgreSQL 16:** ACID-compliant relational storage with JSONB support for dynamic audit trails.
- **Redis 7:** Session storage, distributed rate limiting, real-time unread notification caching, and WebRTC participant presence.
- **AWS S3 / Cloudflare R2 / MinIO:** Encrypted storage for student admission documents, scanned exam papers, recorded lectures, and Maktaba Ashrafia PDF manuscripts.
