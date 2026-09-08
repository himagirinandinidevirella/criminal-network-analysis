# CrimeNet feature check

**Checked:** 8 September 2026 (Asia/Calcutta)

**Runtime:** standalone browser demo, `VITE_DEMO_MODE=true`

**Branch:** `arena/01a07b62-criminal-network-analysis`

## Verdict

**The implemented browser-demo workflows pass their tests. Not all requested or advertised full-stack features are implemented, connected, or verified.**

The demo is usable for software evaluation with synthetic data and authorised local recordings. These results are not a production-readiness, biometric-accuracy, security, or forensic-certification assessment.

## Checks executed in this review

| Check | Result |
| --- | --- |
| `npm test` | **70/70 unit tests passed**, across 12 test files |
| `npm run test:e2e` | **32/32 browser workflow tests passed** |
| `npm run lint` | TypeScript checking passed |
| `npm run build` | Full-backend-mode frontend compiled successfully; backend operation was not tested |
| `npm run build:demo` | Standalone demo bundle compiled successfully |
| Lockfile vs. package metadata | Dependencies, dev dependencies and Node engine constraints match |
| `bash -n start.sh start-demo.sh` | Startup script syntax passed |
| `python -m compileall -q backend/app` | Python syntax passed only; this does not execute or validate backend services |
| `git diff --check` | Passed |
| Built-demo browser smoke check | Login/dashboard plus 13 additional routes rendered successfully |
| Built-demo critical functions | Actual local face detection, SHA-256 calculation, and signed WebAuthn verification passed |

The final built-demo smoke run had **no uncaught JavaScript errors, HTTP error responses, failed requests, or external requests** in the exercised flows. The optional external map layer was not enabled.

An initial rapid-navigation smoke run cancelled a few in-flight layout/audio downloads. Those assets returned HTTP 200 individually, and the check passed after allowing each page's requests to settle. No application fix was needed for that navigation artefact.

## Feature status

| Feature | Status | What was actually checked / limitation |
| --- | --- | --- |
| Demo login, session persistence, logout | **Passed** | Public synthetic demo accounts; not production authentication or an enforced security boundary. |
| Dashboard, counts and charts | **Passed** | Computed from the synthetic fixture, not live police data. |
| Search and advanced filters | **Passed** | Queries, combined filters, no-result handling and updated global searches. |
| FIR entity preview | **Passed — limited** | Fixture-name matching and identifier patterns. Not BERT/NLP model inference or a complete PDF/OCR ingestion pipeline. |
| Network graph | **Passed** | Entity inspection, filtering, layouts and PNG export. |
| Shortest paths / what-if | **Passed** | Graph-based path calculation and non-destructive node-removal simulation. Not crime prediction. |
| Person profiles, notes, verification flags | **Passed** | Fictional profiles and local review actions survive reload. |
| File checksum registration | **Passed** | Actual SHA-256; file contents are not uploaded or retained. |
| Alerts | **Passed — local events** | Trigger, view, assign, escalate, resolve and saved rule configuration. No live monitoring stream or automatic rule evaluation is connected. |
| Reports | **Passed** | Actual PDF, CSV, XLSX and JSON downloads; selected sections and report history work. |
| Report sharing | **Passed — browser-local only** | Preview snapshots, expiry and view/download handling. Links do not provide cross-device public sharing or server-side security. |
| Geographic view | **Passed — synthetic** | Fixture locations and case filters. External OpenStreetMap availability was not validated. |
| Assistant | **Passed — rule-based** | Supported fixture queries and unsupported-request handling. Not an LLM. |
| Integrity Lab | **Passed** | Actual SHA-256 comparison, not blockchain or court certification. |
| Four-camera CCTV wall | **Passed** | Multiple local recordings, simulated views, single-view focus, pause/play, snapshots, source cleanup and error handling. |
| Live CCTV camera connection | **Not connected** | No authorised RTSP/HLS/WebRTC gateway or physical camera was configured/tested. |
| AI face detection | **Passed on synthetic test footage** | The actual local Tiny Face Detector finds the bundled test face. Boxes/counts, confidence controls and model-load retry work. This is not an accuracy/fairness benchmark or a guarantee for all angles. |
| Cross-camera tracking | **Passed — manual only** | Operator-linked event trails, ordered camera sequences, replay of available sources, export, persistence and deletion. No automatic person handoff or identity tracking. |
| Face matching / automatic person re-identification | **Not available in the running demo** | Face detection must not be described as identity recognition. |
| Number-plate recognition / ANPR | **Not implemented** | Text searches for vehicle registrations are not number-plate OCR from video. No corresponding application implementation was found. |
| Loitering detection | **Not implemented** | No dwell/loitering detection implementation was found. |
| File fingerprint verification | **Passed** | SHA-256 calculation, comparison against a hash or another file, stale-result clearing and JSON export. |
| Device biometric/passkey verification | **Passed with a virtual authenticator** | Registration, actual ES256 assertion verification, cancellation, account separation and unavailable/embedded states. This is browser-local demonstration code, not production authentication. |
| Physical fingerprint reader | **Not tested** | Requires compatible hardware/browser, HTTPS or localhost, and a top-level tab. The device may use a fingerprint, face or PIN; the app cannot tell which. |
| Uploaded fingerprint-scan matching / AFIS | **Not genuine verification in this demo** | The working page uses file hashes or device passkeys, not fingerprint-ridge matching or criminal-database identification. See the legacy-code warning below. |
| Notifications | **Partly checked** | Preference persistence and local alert UI were checked. Real OS permissions, sound output and delivery need testing on the user's device. |
| Guided tour, reset and mobile navigation | **Passed** | Tour completion, local reset, invalid routes, responsive navigation and mobile workflows. |
| FastAPI, Neo4j, PostgreSQL, Redis | **Not running / not integration-tested** | Only the frontend preview was listening. Port 8000 did not respond; Docker and pytest executables were unavailable here. |
| Full-stack ML, IPFS, blockchain, inter-agency sharing | **Not connected / not validated** | Source/prototype modules are not evidence that deployed integrations work. |

## Important legacy-code warning

`backend/app/services/investigation_engine.py` contains prototype output that must not be mistaken for real forensic verification:

- `_match_biometrics()` selects candidates using seeded randomness and produces synthetic confidence/minutiae values rather than analysing fingerprint or DNA samples.
- `legal_certificate_preview` returns hardcoded court-admissibility/blockchain status labels. These are not verified legal determinations or chain receipts.
- The autonomous investigator UI exposing this legacy path is hidden in the current standalone demo. The tested **Fingerprint Verification** page is a separate SHA-256/WebAuthn workflow.

**Do not use these legacy AFIS, confidence or certificate labels for identification, legal decisions or evidence.** They need to remain disabled or explicitly labelled as simulated; passing the frontend tests does not validate them.

## What still needs attention

1. Number-plate OCR and loitering detection remain absent; neither should be demonstrated as working.
2. Use accurate names: face **detection**, **manual** cross-camera event tracking, file checksums, and **device** passkey verification.
3. Connect and validate authorised live-camera/backend infrastructure separately if live operation is required.
4. Test an actual fingerprint-capable device using the **Open biometric verification in a new tab** link. No real scanner was available in this check.
5. Treat demo login, browser-local sharing, locally editable passkey registration and synthetic risk scores as evaluation features—not production controls.

## Scope of this check

Browser tests used Chromium in the sandbox, fresh test contexts and a virtual WebAuthn authenticator. They did not operate the user's physical devices or modify the user's browser data. The existing demo server remains on port 3000; the temporary built-demo test server was stopped.

No application source was changed during this check. This report records the observed results and the distinction between working demo flows and missing/unverified integrations. Passing tests reduces the chance of regressions; it does not prove every possible input or deployment is fault-free.
