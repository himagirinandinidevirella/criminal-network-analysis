# CrimeNet AI — Video Demonstration Script (5 minutes)

Timed, word-for-word narration + on-screen actions. Every feature below is
verified working in real mode. A 3-minute short cut is at the end.

---

## BEFORE RECORDING — checklist (5 min)

1. Start everything:
   - Docker: `docker compose up -d neo4j postgres redis ganache`
   - Backend: `cd backend && venv\Scripts\activate && set ML_LOAD_MODELS=false && uvicorn app.main:app --port 8000`
   - Frontend (REAL mode — no demo flag): `cd frontend && npm run dev`
2. **Warm the LLM**: open AI Assistant, ask one question, wait for the reply.
   (The model loads at backend startup, but a warm-up question makes the
   on-camera answer fast.)
3. Browser: open `http://localhost:3000`, log out, stay on the **Login page**.
4. Close extra tabs, hide bookmarks bar, set zoom to 100%.
5. Optional second monitor with this script. Record at 1920×1080.

---

## SEGMENT 1 — Hook & problem (0:00 – 0:20)

**ON SCREEN:** Login page (do nothing yet).

**SAY:**
> "Every day, police departments collect FIRs, call records, financial trails
> and seizure reports — but they sit in separate files. CrimeNet AI joins them
> into one living criminal network, so an investigator sees the whole syndicate,
> not just one suspect. This is our Smart India Hackathon entry — let me show
> you, live."

---

## SEGMENT 2 — Secure login & roles (0:20 – 0:45)

**ON SCREEN:** Type `admin@crimenet.gov.in` / `Admin@123`, click **SECURE LOGIN**.

**SAY:**
> "Access is role-based — Admin, Senior Officer, Officer and Analyst each get
> a different view. Behind this login: JWT authentication, per-IP rate
> limiting, and every action is written to an audit trail — court-ready
> accountability by design."

**ACTION:** After the dashboard loads, point at the sidebar (top to bottom).

---

## SEGMENT 3 — Dashboard (0:45 – 1:20)

**ON SCREEN:** Let the dashboard breathe; move the mouse over the stat cards,
alerts panel and network preview.

**SAY:**
> "The command dashboard gives the operational picture: five hundred tracked
> persons, active investigations and live alerts — all served from a Neo4j
> knowledge graph with PostgreSQL for records, Redis for caching, and a
> blockchain node for integrity. Everything here is synthetic data, generated
> for evaluation."

---

## SEGMENT 4 — Network Analysis & Path Finder (1:20 – 2:15) ⭐ highlight

**ON SCREEN:** Sidebar → **Network Analysis**. Let the graph render. Then:
select **From: Raja Khan**, **To: Vikram Rao**, click **FIND CONNECTION**.

**SAY:**
> "This is the heart of the system — an interactive knowledge graph of
> persons, accounts, vehicles, organisations and locations. Watch the Path
> Finder: I ask for the connection between Raja Khan and Vikram Rao — the
> engine runs a shortest-path search across the graph, up to six hops, and
> shows exactly how they're linked, through which relationships. This is the
> question that normally takes an analyst days."
>
> (After the path renders) "…and every hop is a real relationship in the
> database — not a guess."

**ACTION:** Click the **GANGS** tab to show detected communities, then
**WHAT-IF** tab briefly ("simulate an arrest").

**SAY (short):**
> "Community detection groups the network into gangs automatically, and the
> What-If simulator lets investigators test the impact of arresting a key
> member before they act."

---

## SEGMENT 5 — Investigation: FIR to graph (2:15 – 2:55) ⭐ highlight

**ON SCREEN:** Sidebar → **Investigation** → **Graph Extraction Pipeline** tab.
Paste the sample FIR (keep it on your clipboard) → click **ANALYZE FIR**.

**SAY:**
> "Now the input side. I paste a raw First Information Report — plain English.
> The NLP engine extracts persons, locations, vehicles, organisations and
> financial identifiers, and writes them straight into the knowledge graph.
> See — 'Graph updated: persons, vehicle, organisation, location'. A document
> became queryable network data in seconds."

**TIP:** Use this FIR text (creates clean entities):
`FIR No: 99/2024. Suspect Vikram Rao was seen at Andheri, Mumbai with Meena Patil. Vehicle MH-03-CD-1111 used in the escape.`
(Note: this adds 3 test persons to the graph — fine for demo day; the top-risk
list ignores unscored persons.)

---

## SEGMENT 6 — Criminal profile: risk & predictions (2:55 – 3:25)

**ON SCREEN:** Open **Raja Khan** (search "Raja Khan" top bar → open profile).
Show risk score, then the Predictions tab.

**SAY:**
> "Each suspect carries an explainable risk score — here Raja Khan scores
> ninety-five out of one hundred, driven by his network centrality and case
> history. The prediction engine estimates recidivism probability, likely
> crime type and location, and anomaly detection flags unusual financial
> spikes — like this forty-five lakh transfer."

---

## SEGMENT 7 — Real-time alerts (3:25 – 3:40)

**ON SCREEN:** Sidebar → **Alerts**. Show the alert list and an alert's
assign/escalate actions.

**SAY:**
> "Alerts stream to investigators in real time over WebSocket — each one can
> be assigned, escalated and resolved, with full history preserved."

---

## SEGMENT 8 — AI Assistant with local LLM (3:40 – 4:15) ⭐ highlight

**ON SCREEN:** Sidebar → **AI Assistant**. Click the suggested chip
**"Top 5 highest risk criminals"** → instant answer. Then type:
*"Show me the network map"* → the assistant points to the sidebar.

**SAY:**
> "The AI Assistant answers natural-language questions. Structured queries —
> top risks, gangs, suspicious transactions — are answered instantly from the
> graph. And it runs on a local language model, Qwen two-point-five, one-point-five
> billion parameters, executing fully on this laptop — no cloud, no data ever
> leaves the machine. That matters for evidence handling."

**TIP:** If asked about the model later: quantised 4-bit GGUF via
llama-cpp-python, CPU inference, ~1 GB RAM.

---

## SEGMENT 9 — Blockchain Integrity Lab (4:15 – 4:40)

**ON SCREEN:** Sidebar → **Blockchain**. Register one evidence item, then
verify it.

**SAY:**
> "Court admissibility needs integrity. Every record and report can be
> fingerprinted with SHA-256 onto a blockchain ledger — Ganache in this demo,
> any Ethereum node in production. Verify returns a certificate; any tampering
> breaks the hash and is detected immediately."

---

## SEGMENT 10 — Architecture & close (4:40 – 5:00)

**ON SCREEN:** Jump back to the Dashboard (wide shot of the app).

**SAY:**
> "To recap: a React front end, a FastAPI service layer with sixty-plus
> endpoints, a Neo4j criminal knowledge graph, machine-learning risk and
> prediction models, a local LLM assistant, and a blockchain integrity layer —
> all running on one laptop, all working end-to-end. CrimeNet AI: from
> scattered documents to actionable intelligence. Thank you."

---

# 3-MINUTE SHORT CUT (if the limit is 3 min)

| Time | Segment |
|---|---|
| 0:00–0:15 | Hook (Segment 1, shortened) |
| 0:15–0:30 | Login + roles (one line) |
| 0:30–1:10 | Dashboard (15s) → Network + Path Finder (25s) |
| 1:10–1:45 | FIR → graph extraction |
| 1:45–2:10 | Criminal profile: risk 95 + prediction |
| 2:10–2:35 | AI Assistant: one chip question + "local LLM" line |
| 2:35–3:00 | Architecture recap + close |

# LIKELY JURY QUESTIONS & ANSWERS

- **"Is the data real?"** — No. 500 synthetic persons/relationships generated
  for evaluation; no real personal data anywhere.
- **"Why a local LLM instead of ChatGPT?"** — Evidence handling: case data must
  not leave the machine. The 1.5B model runs offline on CPU; the assistant is
  also fully functional without it (rule-based graph queries).
- **"How does risk scoring work?"** — XGBoost model over network features
  (centrality, associations, case history); predictions via LSTM-style
  sequence models. Currently loaded on demand (`ML_LOAD_MODELS`).
- **"What about privacy/law?"** — Role-based access, full audit trail,
  synthetic-data mode for training, blockchain for tamper-evidence.
- **"Scale?"** — Neo4j handles millions of nodes; the API is stateless and
  Redis-cached; the LLM tier can be swapped for larger models or GPU.
- **"What's deployed?"** — Full docker-compose stack (Neo4j, Postgres, Redis,
  Ganache, IPFS, backend, frontend) plus local dev servers for the live demo.

# FALLBACK PLAN

- If the LLM is slow on camera: use the chip questions only, and say
  "free-form answers run locally and take a few seconds on CPU".
- If a page is slow first time: it's compiling/caching — click it once during
  warm-up before recording.
- Screenshots of every page are in `backend/ui_sweep_shots/` as backup slides.
