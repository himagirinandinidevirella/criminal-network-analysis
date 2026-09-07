# 🕸️ CrimeNet AI — AI-Powered Criminal Network Analysis System

**Smart India Hackathon 2025** · Ministry of Home Affairs — India

CrimeNet AI is a full-stack intelligence platform that ingests police records
(FIRs, CDRs, bank/UPI transactions, vehicle data), extracts entities with
multilingual NLP, builds a **Neo4j knowledge graph**, and applies **Graph Neural
Networks, XGBoost risk scoring, anomaly detection and crime prediction** to help
investigators visualise and disrupt criminal networks.

---

## 🎯 The 10-Step Workflow (SIH 2025 diagram)

```
DATA SOURCES → DATA COLLECTION → DATA PREPROCESSING → ENTITY EXTRACTION (NLP)
→ GRAPH CREATION (Neo4j) → AI/ML MODELS → NETWORK ANALYSIS → VISUAL DASHBOARD
→ INVESTIGATOR ACTION → REPORT GENERATION
```

| Step | Implementation |
|------|----------------|
| 1. Data Sources | FIR text/PDF, CDR CSV, bank/UPI/crypto records, social/news, vehicle (RTO), court records |
| 2. Data Collection | Bulk CSV/PDF/Excel/JSON import, REST upload endpoints, drag-and-drop UI, Kafka/WebSocket ingestion |
| 3. Preprocessing | HTML strip, date/phone normalisation, Pydantic validation, dedup, imputation, geocoding |
| 4. Entity Extraction | `multilingual-bert-base-cased` + spaCy + regex → PERSON/LOCATION/VEHICLE/ACCOUNT/ORGANIZATION |
| 5. Graph Creation | Neo4j nodes (Person, Vehicle, Account, Organization, Location, Transaction, CrimeEvent) + 12 relationship types |
| 6. AI/ML Models | NLP extractor, GraphSAGE GNN, XGBoost+SHAP risk scorer, Isolation Forest+LSTM anomaly detector, LSTM+RF crime predictor, link predictor |
| 7. Network Analysis | PageRank/centrality, Louvain communities, shortest paths, hidden-link prediction, what-if simulation |
| 8. Visual Dashboard | Cytoscape network map, Recharts, Leaflet heatmap, risk panel, alert feed |
| 9. Investigator Actions | Verify (badge + timestamp), notes (react-quill), evidence upload (chain of custody), flag/escalate |
| 10. Report Generation | PDF (ReportLab), CSV, Excel (openpyxl), JSON + secure expiring share links |

---

## 🏗️ Tech Stack

**Frontend** — React 18 · TypeScript · Vite · TailwindCSS · Redux Toolkit ·
Cytoscape.js · Recharts · Leaflet · D3 · Framer Motion · socket.io-client ·
jsPDF · react-quill

**Backend** — FastAPI · Neo4j (graph) · PostgreSQL (audit/reports) · Redis (cache)
· PyTorch Geometric (GraphSAGE) · Transformers (multilingual BERT) · XGBoost ·
SHAP · scikit-learn · spaCy · NetworkX

---

## 📁 Project Structure

```
criminal-network-analysis/
├── frontend/            React + TypeScript SPA
│   ├── public/          index.html, favicon, logo, alert sound
│   └── src/             components, pages, services, store, types, utils, hooks
├── backend/             FastAPI application
│   ├── app/
│   │   ├── api/         routes + middleware
│   │   ├── models/      Pydantic schemas
│   │   ├── services/    graph, risk, anomaly, nlp, report, alert, export, share
│   │   ├── database/    neo4j / postgres / redis connections
│   │   ├── ml_models/   6 ML model modules
│   │   └── websocket/   real-time alert manager
│   ├── data/            synthetic data generator + sample FIRs (EN/HI)
│   └── tests/           pytest suite
├── docker-compose.yml   frontend, backend, neo4j, postgres, redis, nginx
├── nginx.conf           reverse proxy (+ WebSocket, gzip, security headers)
├── .env.example         configuration template
└── start.sh             one-command bootstrap
```

---

## 🚀 Quick Start

```bash
# 1. Clone / copy this project
# 2. (Optional) copy .env.example → .env and adjust secrets
# 3. Start everything
bash start.sh
```

The script boots the stack in order (infra → databases → backend → synthetic
data → frontend + nginx) and prints access URLs.

```
✅ CrimeNet AI is running!
   🌐 Dashboard:  http://localhost
   📡 API Docs:   http://localhost:8000/docs
   🕸️ Neo4j UI:   http://localhost:7474
   ⚡ Health:     http://localhost:8000/health
```

### Demo accounts

| Role | Login | Password |
|------|-------|----------|
| Admin | `admin@crimenet.gov.in` | `Admin@123` |
| Officer | `officer@crimenet.gov.in` | `Officer@123` |
| Analyst | `analyst@crimenet.gov.in` | `Analyst@123` |
| Senior Officer | `senior@crimenet.gov.in` | `Senior@123` |

Guest link: `/public/report/demo-token-2025`

### 🎬 Demo Mode (hackathon demo scenario)

The login page has a **DEMO MODE** button that auto-runs the ~5-minute guided
tour from the SIH 2025 spec:

1. Dashboard overview → 2. FIR auto-analysis (NLP) → 3. Network exploration →
4. Risk & anomaly (SHAP) → 5. Predictions → 6. Live alert (flash + sound) →
7. AI chatbot → 8. Report generation

It logs in with the demo admin account, drives the app through every screen,
fires a real WebSocket alert, and shows a narrated overlay with pause / skip /
exit controls. Backend endpoint: `POST /api/demo/trigger-alert`.

### 🚰 Streaming & background tasks (optional wiring)

- `backend/app/services/streaming_service.py` — Apache Kafka ingestion
  (CDR / transactions / FIR) with automatic deduplication; degrades to an
  in-process pub/sub bus when no broker is present. Set `KAFKA_BOOTSTRAP_SERVERS`
  and add a `kafka` service to `docker-compose.yml` to enable.
- `backend/app/services/tasks.py` — Celery tasks for async report generation
  and nightly PageRank/centrality pre-computation. Set `CELERY_BROKER_URL` and
  run `celery -A app.services.tasks worker` to enable; `run_task()` falls back
  to inline execution otherwise.

### Manual startup (without start.sh)

```bash
docker compose up -d neo4j postgres redis
sleep 30
docker compose up -d backend
docker compose exec backend python data/synthetic_data_generator.py
docker compose up -d frontend nginx
```

---

## 🧠 Synthetic Dataset — "Operation Mumbai"

The seed script (`backend/data/synthetic_data_generator.py`) generates a
realistic, reproducible Indian criminal network:

- **500 criminals** (Indian names), **50 organizations**, **200 locations**
- **~2,000 relationships**, **1,000 financial transactions** (with anomalies),
  **500 CDR records** (with pre-crime spikes), **100 crime events**, **50
  vehicles**, **100 bank accounts** (30 flagged)
- Core characters: **Raja Khan** (boss, risk 95), **Shyam Verma** & **Meena
  Patil** (lieutenants), **Vikram Rao** (Eastern Syndicate), **Priya Hacker**
  (Dark Web Cell), plus a hidden cross-network link.

---

## 🔐 Security & Access Control

- **JWT** — 15-min access / 7-day refresh tokens (python-jose)
- **Bcrypt** password hashing (12 rounds)
- **Rate limiting** — 100 req/min per user (Redis counters)
- **IP lockout** after 5 failed logins
- **Full audit trail** — every mutating request logged to PostgreSQL
- **Role-based access** — ADMIN / SENIOR_OFFICER / OFFICER / ANALYST / VIEWER
- **Security headers** — HSTS, CSP-ready, X-Frame-Options, nosniff
- **Secure sharing** — expiring tokens (24h/7d/30d), View vs Download, access
  counting, revocable
- **Parameterised queries** everywhere (SQL-injection safe)

---

## 🧪 Tests

```bash
cd backend
pip install -r requirements.txt
pytest                              # unit + logic tests (no DB required)
pytest -m integration               # requires the full stack
```

---

## 📄 License

This project was built as a Smart India Hackathon 2025 submission. All data is
synthetic and generated for demonstration purposes only.
