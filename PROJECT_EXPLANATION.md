# CrimeNet AI — AI-Powered Criminal Network Analysis System

**SIH 2026 · Problem Statement ID: SIH26189 · Theme: Blockchain & Cybersecurity**

---

## 1. Short Version (Elevator Pitch)

CrimeNet AI is an AI-powered intelligence platform for police and law-enforcement
agencies. It reads investigation data (FIRs, call records, bank/UPI/crypto
transactions, vehicle records), automatically extracts the people, places,
organizations and accounts involved, and builds a **criminal network graph**. It
then uses AI (Graph Neural Networks, XGBoost risk scoring, anomaly detection,
crime prediction) to find hidden connections, key players and communities — and a
**blockchain layer** to keep every piece of evidence and every action tamper-proof
and court-admissible. Result: faster, data-driven, and legally defensible
investigations.

---

## 2. Easy Version (Simple Analogy)

Imagine a crime case where the same criminal network appears across 100 different
files — FIRs, phone records, bank transactions. A human officer would need weeks to
connect the dots, and even then might miss the hidden links.

**CrimeNet AI works like a smart map for crime:**

- 🧠 **It reads everything** — police reports, phone calls, money transfers.
- 🔍 **It finds the "who, where, and what"** — automatically picking out names,
  places, organizations, vehicles, and bank accounts from the text (even in Hindi).
- 🕸️ **It draws a picture of the network** — like a web showing who knows whom,
  who pays whom, and who works for whom.
- 🎯 **It points out the important people** — the boss, the lieutenants, the money
  handlers — with a risk score from 0–100.
- 🔮 **It predicts what might happen next** — future crimes, new hidden links,
  suspicious behavior.
- 🔒 **It locks everything on a blockchain** — so evidence can't be secretly
  changed, and every officer's action is recorded forever.

Think of it as **Google Maps + a crystal ball + a tamper-proof vault**, all built
for police investigators.

---

## 3. Detailed Version (Full Technical Picture)

### The Problem
Criminal networks span multiple people, locations, organizations and accounts.
Their information is scattered across FIRs, CDRs (call records), chats and
financial transactions. Manual analysis is slow, error-prone, and misses hidden
relationships — and there is no tamper-proof way to prove evidence has not been
altered.

### How It Works — the 8-Step Pipeline
1. **Data Collection** — ingests FIRs (text/PDF), CDRs, bank/UPI/crypto records,
   vehicle and court records.
2. **Data Preprocessing** — cleans, removes duplicates, normalizes dates/phones,
   validates.
3. **NLP Entity Extraction** — multilingual BERT + spaCy + regex extract **PERSON,
   LOCATION, ORGANIZATION, VEHICLE, ACCOUNT** (and dates) from text — in English
   and Hindi.
4. **Graph Construction** — stores these as a **Neo4j knowledge graph**: 7 node
   types and 12 relationship types.
5. **AI / ML Models** —
   - **GraphSAGE GNN** for node representation,
   - **XGBoost + SHAP** for 0–100 risk scores with explanations,
   - **Isolation Forest + LSTM** for anomaly detection,
   - **Crime prediction** and **link prediction** for hidden connections.
6. **Blockchain Layer** (the theme!) —
   - **5 Solidity smart contracts**: Evidence, Criminal Record, Audit, Report,
     Agency Share.
   - **Evidence integrity**: every file's SHA-256 fingerprint is stored on-chain;
     a changed file is instantly detected as **TAMPERED**.
   - **Immutable audit trail**: every VIEW/EDIT/EXPORT action is recorded forever.
   - **Record integrity** and **report certificates**: verifiable authenticity.
   - **Inter-agency sharing**: time-boxed, level-scoped access between
     STATE_POLICE, CBI, NIA, COURT, INTERPOL, CUSTOMS, NCB.
   - **IPFS** for decentralized evidence storage; **AES-256 encryption**, Ed25519
     signatures.
7. **Cyber-Crime Detection** — flags ransomware, phishing, crypto-laundering,
   dark-web activity, coordinated attacks and social engineering, with a cyber
   risk score.
8. **Visualization & Reports** — Cytoscape network maps, dashboards, heatmaps,
   alerts, and PDF/Excel/JSON reports.

### The Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind, Redux, Cytoscape, Recharts,
  Leaflet.
- **Backend**: FastAPI (79 endpoints), Neo4j, PostgreSQL, Redis, WebSockets for
  live alerts.
- **ML**: PyTorch Geometric, Transformers, XGBoost, SHAP, scikit-learn, spaCy.
- **Blockchain**: Solidity 0.8.19, Hardhat, Ganache, Web3.py, IPFS, cryptography.
- **Data**: synthetic **"Operation Mumbai"** dataset — 500 criminals, 50
  organizations, 200 locations, ~2,000 relationships.

### Key Superpower: Graceful Degradation
The blockchain is an *enhancement, not a dependency*. If Ganache/IPFS are down,
the system automatically falls back to a built-in local ledger and content store —
it **never breaks**.

---

## 4. Why It Matters (Importance)

**For investigators/police:**
- Cuts investigation time from weeks to hours by automating the "connect the dots"
  work.
- Reveals hidden links, the real kingpins, and community structures that manual
  analysis misses.
- Gives every suspect a transparent, explainable risk score.

**For the courts and legal process:**
- Blockchain-backed evidence is **tamper-evident** — the system can prove a file
  was never altered.
- The **immutable audit trail** shows exactly who accessed what and when — making
  findings court-admissible.
- Report certificates let any agency verify a report's authenticity.

**For society:**
- Faster investigations → quicker justice → improved public safety.
- Stronger inter-agency coordination (police ↔ CBI ↔ NIA ↔ INTERPOL) through
  secure, time-limited data sharing.
- Reduced financial losses from organized crime and cybercrime.

**For the SIH 2026 theme (Blockchain & Cybersecurity):**
- A submission that *genuinely* implements both halves of the theme — AI for the
  criminal network, blockchain for the trust layer — rather than just naming them.
- Aligned with real NCRB/CCTNS needs and modern cyber-threats (crypto laundering,
  dark web, ransomware).
