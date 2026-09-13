# 🕸️ CrimeNet AI — AI-Powered Criminal Network Analysis System

**Smart India Hackathon 2025 · Ministry of Home Affairs — India**

> 🚨 **Interactive demo:** run `bash start.sh --demo` (Node.js 20+) → open
> `http://localhost:3000` → click **Explore demo**. No Docker, database, API key
> or model download needed — everything runs locally in your browser.
> Full-stack mode (real Neo4j + local LLM) is documented below.
>
> ⚠️ All people, relationships and scores are **synthetic**. For software
> evaluation only.

CrimeNet AI ingests police records (FIRs, CDRs, bank/UPI transactions, vehicle
data), extracts entities with NLP, builds a **Neo4j criminal knowledge graph**,
and applies **risk scoring, anomaly detection, crime prediction and a local
LLM assistant** to help investigators see — and disrupt — entire networks
instead of single suspects.

![Dashboard](docs/screenshots/dashboard.png)

---

## ✨ Feature Matrix

| Module | Highlights |
|---|---|
| 🔐 **Auth & Roles** | Admin · Senior Officer · Officer · Analyst — JWT, per-IP rate limiting, blockchain-backed audit trail |
| 📊 **Dashboard** | Live network stats, case locations, real-time alert feed |
| 🕸️ **Network Analysis** | Interactive Cytoscape graph (500 nodes) · **Path Finder** (shortest path ≤ 6 hops) · **Gang detection** (community detection) · **What-If arrest simulator** |
| 🔎 **Investigation** | **FIR → knowledge graph**: paste raw FIR text, NLP extracts persons / vehicles / accounts / locations and writes them into the graph · intelligent multi-entity search · autonomous investigator |
| 👤 **Criminal Profiles** | Explainable XGBoost risk score, recidivism & crime-type/location prediction, anomaly flags, timeline, analyst actions |
| 🚨 **Alerts** | Real-time WebSocket alerts, rules engine, assign / escalate / resolve with history |
| 🗺️ **Crime Map** | Leaflet hotspot map of 200+ locations with per-crime-type filtering |
| 🤖 **AI Assistant** | Rule-based graph queries (instant) + **local LLM fallback** (Qwen2.5-1.5B, 4-bit GGUF, CPU-only, fully offline) |
| ⛓️ **Integrity Lab** | SHA-256 evidence & report fingerprinting on a blockchain ledger, tamper detection, court-admissibility certificates |
| 🧬 **Fingerprints** | AFIS-style biometric verification flow |
| 🌐 **Cybercrime** | Phishing URL & crypto-wallet scanning, threat intel |
| 📄 **Reports** | Watermarked PDF / CSV / Excel / JSON exports, public share links |
| 🖥️ **CCTV** | Opt-in browser-local person detection (boxes & counts only) |

---

## 🏗️ Architecture

```mermaid
flowchart LR
    subgraph Client["🖥️ Frontend — React 18 + Vite + Tailwind"]
        UI["Cytoscape graph · Leaflet map · Redux Toolkit"]
    end

    subgraph API["⚙️ Backend — FastAPI (63+ endpoints)"]
        AUTH["JWT auth · RBAC · rate limiter"]
        ROUTES["Criminals · Network · Alerts · Reports\nChatbot · Cybercrime · Blockchain · Export"]
        NLP["spaCy NLP\nFIR entity extraction"]
        RISK["XGBoost risk · anomaly · predictions"]
        LLM["🤖 Local LLM\nQwen2.5-1.5B (llama-cpp, CPU)"]
    end

    subgraph Data["💾 Data & Infrastructure"]
        NEO[("Neo4j\nknowledge graph\n500+ nodes")]
        PG[("PostgreSQL\nusers · audit logs")]
        RD[("Redis\ncache · sessions")]
        GAN[("Ganache\nblockchain ledger")]
        IPFS[("IPFS\nevidence storage")]
    end

    UI -->|REST /api + WebSocket| AUTH
    AUTH --> ROUTES
    ROUTES --> NEO & PG & RD & GAN & IPFS
    ROUTES --> NLP & RISK
    ROUTES --> LLM
```

## 🔄 How an FIR becomes intelligence

```mermaid
sequenceDiagram
    participant I as 👮 Investigator
    participant F as Frontend
    participant B as FastAPI
    participant N as spaCy NLP
    participant G as Neo4j Graph
    participant L as 🤖 Local LLM

    I->>F: paste raw FIR text → ANALYZE FIR
    F->>B: POST /api/criminals/analyze-fir
    B->>N: extract entities (persons, vehicles, accounts…)
    N-->>B: structured entities
    B->>G: MERGE persons / vehicles / locations + relationships
    B-->>F: extraction result + linked records
    Note over G: document becomes queryable network data
    I->>F: "Connect Raja Khan and Vikram Rao"
    F->>B: POST /api/chat/message
    B->>G: shortestPath query (≤ 6 hops)
    G-->>B: path (nodes + relationship types)
    B-->>F: "Path: Raja Khan → … → Vikram Rao (n hops)"
    Note over L: free-form questions fall back to the<br/>local Qwen2.5-1.5B model — 100% offline
```

## 🤖 AI Assistant routing

```mermaid
flowchart TD
    Q["User message"] --> R{"Regex intent match?"}
    R -->|"top risks / gangs / transactions /<br/>hotspots / associates / path / profile"| G["Neo4j Cypher query"]
    G --> A["Instant structured answer"]
    R -->|greeting| H["Instant greeting + suggestion chips"]
    R -->|no match| L["🤖 Local Qwen2.5-1.5B LLM<br/>(llama-cpp-python, CPU, offline)"]
    L -->|answer| A2["LLM reply — intent: llm"]
    L -->|unavailable| C["Canned capability help"]
```

## 🕸️ Knowledge-graph schema

```mermaid
flowchart LR
    P(["👤 Person"]) ---|KNOWS / ASSOCIATE| P
    P ---|LOCATED_AT| L(["📍 Location"])
    P ---|HAS_ACCOUNT| A(["🏦 Account"])
    P ---|OWNS| V(["🚗 Vehicle"])
    P ---|MEMBER_OF| O(["🏢 Organisation"])
    P ---|COMMUNICATED_WITH| P
    A ---|TRANSFERRED_TO| A
```

---

## 🚀 Quickstart

### Option A — instant browser demo (no infrastructure)

```bash
bash start.sh --demo          # or: cd frontend && npm run demo
# open http://localhost:3000 → "Explore demo"
```

### Option B — full stack (real Neo4j + local LLM)

```bash
# 1. Data services
docker compose up -d neo4j postgres redis ganache

# 2. Backend  (Python 3.11+)
cd backend
python -m venv venv && venv\Scripts\activate     # Windows
pip install -r requirements.txt
set ML_LOAD_MODELS=false
uvicorn app.main:app --port 8000

# 3. Frontend
cd frontend && npm install && npm run dev
# open http://localhost:3000
```

**Demo accounts**

| Role | Badge / login | Password |
|---|---|---|
| Admin | `admin@crimenet.gov.in` | `Admin@123` |
| Officer | `officer@crimenet.gov.in` | `Officer@123` |
| Analyst | `analyst@crimenet.gov.in` | `Analyst@123` |
| Senior Officer | `senior@crimenet.gov.in` | `Senior@123` |

### Optional — local LLM assistant

```bash
pip install llama-cpp-python --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu
# drop any chat GGUF into backend/data/models/llm/ (e.g. Qwen2.5-1.5B-Instruct Q4_K_M, ~986 MB)
# it loads in the background at startup; ~1 GB RAM, CPU-only, fully offline
```

---

## 🖼️ Screenshots

| | |
|---|---|
| ![Network Analysis](docs/screenshots/network-analysis.png) | ![Path Finder](docs/screenshots/path-finder.png) |
| *Interactive network graph* | *Path Finder: Raja Khan ⇄ Vikram Rao* |
| ![FIR analysis](docs/screenshots/fir-analysis.png) | ![AI Assistant](docs/screenshots/ai-assistant-llm.png) |
| *FIR → knowledge-graph extraction* | *Local-LLM assistant answer* |
| ![Crime map](docs/screenshots/crime-map.png) | ![AI intent](docs/screenshots/ai-assistant-intent.png) |
| *Geographic crime hotspots* | *Rule-based graph queries* |

---

## 🧪 Testing

- **API sweep** — 63 endpoints across 14 route groups (auth, criminals,
  network, alerts, chat, search, reports, export, cybercrime, blockchain,
  actions, demo): **all green**.
- **Playwright UI sweep** — `backend/ui_sweep.py` drives every page in real
  Chromium, capturing console errors, page errors and failed requests
  (screenshots in `backend/ui_sweep_shots/`). **4 role logins, 13 pages,
  0 errors.**
- Path Finder, FIR extraction, chat intents and LLM answers are exercised
  end-to-end through the real UI on every run.

## 📚 Documentation

- [DEMO_VIDEO_SCRIPT.md](DEMO_VIDEO_SCRIPT.md) — timed 5-minute video walkthrough
- [DEMO_GUIDE.md](DEMO_GUIDE.md) — browser demo guide & limitations
- [PROJECT_EXPLANATION.md](PROJECT_EXPLANATION.md) — architecture deep-dive
- [FEATURE_CHECK.md](FEATURE_CHECK.md) — feature verification matrix

## 🛠️ Tech stack

`React 18` · `Vite` · `Tailwind CSS` · `Redux Toolkit` · `Cytoscape.js` ·
`Leaflet` · `FastAPI` · `llama-cpp-python` · `spaCy` · `XGBoost` · `scikit-learn` ·
`Neo4j` · `PostgreSQL` · `Redis` · `Ganache` · `IPFS` · `Playwright` · `Docker Compose`

---

> ⚠️ **Disclaimer** — CrimeNet AI is a hackathon prototype operating entirely
> on synthetic data. It is not connected to any real police database and makes
> no claims of production readiness or investigative accuracy.
