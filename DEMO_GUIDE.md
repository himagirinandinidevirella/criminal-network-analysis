# CrimeNet — standalone demo guide

A working, **browser-only synthetic-data demo** of the existing CrimeNet project.
It does not require Docker, Python, databases, API keys, a GPU, or a blockchain.
The full-stack source is preserved as a separate runtime mode.

> **For software evaluation only.** All people, relationships, case records and
> risk scores in this demo are fictional. Do not enter real personal, police,
> financial or biometric data. Nothing here is evidence or a prediction about
> a real person.

## 1. Start the project

Install **Node.js 20+** and npm, then run from the repository root:

```bash
bash start.sh --demo
```

The script installs frontend dependencies if needed and starts Vite on port 3000. Open the live preview, or `http://localhost:3000` when running on your own
computer, and choose **Explore demo**. **Start guided walkthrough** runs the
optional eight-step tour with pause, next, and finish controls.

Manual setup, including on Windows without Bash:

```bash
cd frontend
npm ci
npm run demo
```

To choose another port:

```bash
bash start.sh --demo --port 3001
```

### Demo accounts

The one-click entry uses the demo administrator. Manual login also supports:

| Role           | Badge / login             | Demo password |
| -------------- | ------------------------- | ------------- |
| Admin          | `admin@crimenet.gov.in`   | `Admin@123`   |
| Officer        | `officer@crimenet.gov.in` | `Officer@123` |
| Analyst        | `analyst@crimenet.gov.in` | `Analyst@123` |
| Senior officer | `senior@crimenet.gov.in`  | `Senior@123`  |

These are public, fictional demo credentials—not real accounts. Roles and login
illustrate the interface; **they are not a security boundary** in browser mode.

## 2. What you can try

| Screen             | Working demo flow                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard          | Live counts computed from the local fixture, charts, graph preview, case locations and active alerts.                                                                      |
| Investigation      | Search names, aliases, vehicle registrations, accounts and locations; combine risk, case-type and status filters. Non-person results open in the graph.                    |
| FIR Entity Preview | Match known fixture names and simple vehicle/account patterns in text. Shows candidates and does not write new graph records.                                              |
| Network Analysis   | Inspect any entity with the canvas or keyboard-accessible dropdown; change layouts, zoom, fit, reset and download a PNG.                                                   |
| Path Finder        | Calculate an actual breadth-first shortest path, treating relationships as traversable in either direction, up to six hops. Try Raja Khan → Vikram Rao.                    |
| What-If            | Temporarily remove a node and calculate changes to edges and connected components. Does not mutate the dataset or predict an arrest's outcome.                             |
| Seeded Networks    | Show groups derived from the fixture's membership edges. Not a Louvain or GNN result.                                                                                      |
| Person profile     | Review associates, accounts, vehicles and case history. Verify, flag and add a local note. Actions survive reload.                                                         |
| File checksum      | Calculate SHA-256 locally and save the file's name, size and hash. Maximum 5 MB. File contents are **not uploaded or retained**.                                           |
| Alerts             | Manually trigger a local event; view, assign to yourself, escalate and resolve it. Rule configuration is saved, but automatic stream evaluation is not connected.          |
| Geographic map     | Filter synthetic case locations and counts. The default coordinate view requires no tile service. The optional OpenStreetMap basemap requires internet.                    |
| Demo Assistant     | A rule-based helper for fixture profiles, associates, paths, scores, groups, transactions and locations—not an LLM.                                                        |
| Integrity Lab      | Save a temporary reference checksum, edit text and compare actual SHA-256 values. A mismatch detects a change, not authorship or legal admissibility.                      |
| Reports            | Generate distinct profile, case, network or executive reports as real PDF, CSV, XLSX or JSON files. Selected sections are honored; every file has a synthetic-data notice. |
| Report History     | Re-download an original data snapshot, or create a local preview link.                                                                                                     |
| Public previews    | Open `/public`, view the sample report without login, or open a locally generated preview. Invalid, expired and view-only links are handled explicitly.                    |
| Settings           | See the actual demo runtime status, save notification preferences, sign out locally, or reset the workspace.                                                               |

### CCTV: AI face detection and all-camera view

Use **Dashboard → CCTV monitor** to open the workspace. **All cameras** is the
default 2×2 view; select a camera or use its focus button for a **Single camera**
view. Four separate angles require four source cameras/recordings. This is a
multi-view display, **not** a reconstructed 360-degree view from one camera.

#### Try it without your own footage

Click **Try AI test clip**. This loads a small, locally bundled, AI-generated
clip of a fictional adult and enables the real Tiny Face Detector. Wait for
**Face detector ready** and a face box with a confidence score. The test clip
is explicitly labeled synthetic; it is not live CCTV or an identified person.
The other tiles show the existing diagrammatic simulations or unavailable
camera states. Illustrations are not passed to the face detector.

#### Review multiple recordings

- **Open recordings** accepts up to four MP4/WebM files, 100 MB each. They are
  assigned in camera order starting at the selected camera. Invalid or
  over-capacity selections leave existing recordings unchanged.
- Each view has its own media element and playback position. **Play all
  recordings** / **Pause all recordings** operate the visible recordings;
  they do not synchronise timestamps. Switch to **Single camera** for native
  playback and seek controls. Switching views preserves loaded clips and their
  positions; hidden videos pause.
- Search/filter the camera list by ID, name, sector or configured demo status.
  These statuses describe the fictional catalogue, not real device health.
  A slot with a recording is labeled as a recording, not a connected camera.
- Close a recording, replace it, use **Close all recordings**, or leave the
  dashboard to release its temporary blob URL. Video bytes never enter Redux,
  localStorage, reports, or a server upload. Files do not survive a reload.
- Use only footage you are authorised to process. Unsupported codecs or damaged
  recordings display an error and disable that view's frame actions.

#### What the AI does—and does not do

- **Enable AI face detection** opts in to on-device inference using
  `@vladmandic/face-api`'s Tiny Face Detector. Only the detection network is
  loaded. The model files are shipped at `/models/face-detector/`, served from
  the same origin. No cloud inference API or external model CDN is used.
- Faces receive bounding boxes, confidence scores and per-frame counts.
  **Minimum confidence** changes the score threshold. Counts are detections
  per analysed view, not unique people; the same face in two views may be
  counted twice. The app does not try to associate the two detections.
- There are **no names, face embeddings, biometric templates, identity galleries,
  demographic inferences, criminal-profile matches or cross-camera tracking**.
  Face results never modify a person's risk score or create an automatic crime
  alert. This detector is separate from the fixture-only risk/assistant features.
- Inputs are downscaled and inference is serialised across cameras. WebGL is
  used when available, with CPU fallback. The UI reports the actual backend,
  sample playback time and inference duration. Analysis is sampled, not a
  frame-by-frame or real-time guarantee; pausing recordings gives stable frames.
- Detection pauses for hidden/off-screen views and hidden tabs. Stop detection
  or close/change a clip to clear its boxes. In-flight results after source
  changes/seeks are discarded. Detection results are temporary and are never
  uploaded or persisted. Model weights may remain cached in browser memory.
- Side profiles, small/occluded faces, motion blur and poor lighting can cause
  misses and false positives. This single synthetic test is not an accuracy,
  fairness or forensic benchmark. It does not guarantee coverage of every angle.
- If model loading fails, playback still works. **Retry face detector** reloads
  the local assets; ensure the model directory is served by your static host.

#### Snapshots and manual flags

**Download combined snapshot** exports the current four-view layout as a real
1280×768 PNG, labeling source types and each playback time, with current sampled
face boxes when available. It is not a time-synchronised or certified record.
Single-view **Download snapshot** retains the original frame export. Neither
operation stores image bytes in the workspace.

In a single view, **Flag for review** pauses playback and captures the source,
view ID and playback time for a manual note. Saving creates a manual demo alert
in the existing Alerts page. Only the note and metadata are saved—not footage,
face boxes or identities. Assignment, escalation, resolution, persistence and
**Reset demo data** work as before.

#### Manual cross-camera event tracking

This is an **operator-managed event trail**, not automated person tracking,
face matching, or re-identification. It does not infer that two moments show
the same person or object, or that a camera sequence represents actual travel.

1. Click **Cross-camera tracking** in the CCTV header, or use the bookmark
   button on a camera tile (**Track moment from CAM-…**).
2. Select a current frame. In a single view, **Add moment to trail** is also
   available. The selected source is paused and its relative playback time is
   captured; no screenshot or face data is stored.
3. Create a named trail or choose an existing one, write an event note, and
   explicitly confirm the manual, unverified association. Save the moment.
4. Capture another camera's moment into the same trail. The panel shows the
   camera sequence and an ordered list of moments. Up/down controls let you set
   the review order; independent playback clocks are **not synchronised**.
5. **Jump to moment** focuses that camera and seeks the original available
   recording or versioned synthetic simulation. Local files use per-load media
   tokens, so a closed or same-named replacement file cannot be mistaken for
   the original. After a reload, local-file moments are metadata-only. Built-in
   simulations and the same bundled test clip can be replayed when available.
6. Export the trail as JSON, remove individual moments, or delete a trail with
   confirmation. The export includes an unverified-association notice and no
   file bytes, blob URLs, media-instance tokens, face boxes or identity data.

Up to **12 trails × 50 moments** are saved in this browser's demo workspace.
Existing caches are upgraded without clearing other notes/reports. Resetting
**demo data** removes these trails too. This workflow is available in the
standalone demo; no new tracking backend or live camera connection is claimed.

#### Model assets and real cameras

`npm run prepare:face-model` (from `frontend/`) reproduces the checked-in model
assets from the pinned dependency. The MIT licence, package provenance and
SHA-256 hashes are included beside the weights. Recognition, demographic and
expression model weights are deliberately **not** copied into the application.

No physical camera access or live RTSP/HLS/WebRTC ingestion is configured.
Real cameras need an authenticated stream gateway and authorised feeds; do not
put camera credentials in frontend code. In full-backend mode, four local
review slots are offered rather than fictional connected cameras. Local video
review and face detection work there too, but demo alert creation is disabled.

The camera catalogue is separate from the 112-entity knowledge graph fixture.

### Fingerprint verification: two separate tools

Open **Fingerprint verification** in the sidebar or dashboard. The page separates
file checksums from **device-based** biometric/passkey verification. It does not
compare fingerprint scan images for identity or search criminal fingerprint records.

#### File fingerprints

- **Calculate SHA-256** hashes a selected file locally (any type, up to 25 MB).
  Empty files are valid inputs. No contents are uploaded or persisted.
- To verify integrity, paste a trusted 64-character SHA-256 reference, or choose
  **Compare another file**. Matching bytes produce the same hash even when file
  names differ; visually similar images with different bytes do not match.
- Changing the selected file or reference clears any previous verdict. Results
  from superseded calculations are discarded.
- Copy the hash or download a JSON checksum record with the algorithm, file
  name/size, computed/reference hashes, comparison result and a limitation notice.
- A matching hash demonstrates consistency with the supplied reference, not
  authorship, a human identity, provenance or court admissibility. A fingerprint
  scan can be checked as a _file_, but its ridge pattern is not analysed.

#### Device biometrics / passkeys

This is a **local WebAuthn demonstration**, not a production authentication
system. It verifies a fresh signed response against a public key self-enrolled
for the current browser account and website. It never changes app roles, logs
you in, or verifies a criminal record or a person's legal identity.

1. Open the **Device biometrics** tab. A compatible platform authenticator,
   HTTPS (or localhost) and a top-level browser tab are required. Embedded
   previews show an **Open biometric verification in a new tab** link instead
   of attempting a blocked credential request.
2. Consent to the device prompt and choose **Register this device**. Your device
   may use a fingerprint, Face ID, a device PIN or another supported method;
   WebAuthn does not reveal which one was used. The application never asks you
   to type a PIN or provide fingerprint scans/templates.
3. Consent again and choose **Verify registered device**. The demo checks the
   fresh challenge, ceremony type, exact origin and relying-party hash,
   credential/account binding, user-presence and user-verification flags, the
   ES256 signature and applicable nonzero signature counters. A new challenge
   is generated for every operation and expires after 60 seconds.
4. Cancel at any time while a prompt is pending. Cancellation, timeout, unsupported
   devices, malformed registrations and signature/verification failures never
   produce a successful verdict. Late responses after leaving the tab are ignored.
5. **Forget local registration** deletes the browser's public-key reference for
   this account/site. It does **not** delete a passkey from your device/provider;
   manage those in the device's passkey settings.

Only the public key, credential reference, random account handle, website/account
binding, signature counter and registration/verification timestamps are stored.
No biometric method, scan, template or private key is returned to this app.
Registrations are isolated by browser origin, runtime mode and account. Device
providers control biometric storage and passkey sync. No hardware attestation
is requested, and zero-counter authenticators cannot be checked for counter reuse.

**Security boundary:** registration data and challenge validation are browser-local
and can be modified by the browser owner. This is therefore not a trusted login,
security gate, hardware certification or forensic identity proof. Production
WebAuthn requires a trusted server to issue and consume challenges, enforce
account binding, store public keys/counters and validate responses. This feature
is explicitly a local demo in both browser-demo and full-backend frontend modes.

Device public-key references are stored separately under a mode/account/origin
scoped `…:device-credential:v1:…` key. **Reset demo data does not remove them**;
use Forget local registration. Clearing site data forgets the local references
but does not remove the authenticator/provider's passkeys.

### Dataset

The seed contains **112 entities**:

- 40 fictional people
- 4 organisations
- 6 locations
- 8 vehicles
- 12 accounts
- 18 case events
- 24 financial transfers

Counts and map filters come from these records, not unrelated dashboard
placeholders. Risk values and their displayed factors are **illustrative
fixtures**, not ML predictions, SHAP explanations or validated risk assessments.

## 3. Storage, sharing and reset

- Workspace changes use `localStorage` under `crimenet:demo-workspace:v1`.
- Demo session keys use `crimenet_demo_*`; real-backend session keys are separate.
- Data belongs to the current browser profile **and origin**. Another browser,
  device, port, or preview hostname has a separate workspace.
- A local preview link stores a snapshot in that workspace. It **does not work
  on another device** and is not secure public sharing. Download a file to share
  the synthetic project results externally.
- Preview links enforce 24-hour, 7-day or 30-day expiry in the local interface.
  View-only links cannot use the demo download endpoint. These checks are not a
  substitute for server-side access control.
- The latest 20 report snapshots, 30 unexpired preview links, 200 notes, 100 file
  checksums, 200 local audit entries, 200 alerts, 100 rule configurations and 12 camera event trails (50 moments each) are
  retained. This is not a collaborative or tamper-proof store.
- Alert events are local to the current app instance. Concurrent tabs are not a
  synchronised multi-user system; refresh a tab to read persisted changes.
- Use **Settings → Reset demo data → Reset workspace** to restore the fixture.
  Reset deletes local notes, file metadata, reports, links, camera event trails and workflow changes.
  It does not remove already-downloaded files, other applications' storage,
  real-backend tokens, notification preferences, or device/passkey registrations.
  Device registration has its own Forget local registration action.
- Clearing site data also resets the demo. Corrupt or incompatible fixture
  caches are re-seeded. Storage-quota failures surface an error rather than
  reporting that an action succeeded.

Fonts are bundled locally. Application API requests stay in the browser in demo mode. The optional CCTV
detector loads its bundled weights from this app’s own static asset server,
not an external AI service.
Enabling OpenStreetMap fetches external map tiles, not case or note contents.
Browser notifications require permission, and audio may require prior user
interaction. Sound is off by default.

## 4. Build and test

From `frontend/`:

```bash
npm ci
npm test                 # deterministic unit / transport / file / session tests
npm run lint             # TypeScript checking
npm run build:demo       # standalone static bundle in dist/
npm run preview          # serve the most recently built bundle
```

For browser tests:

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

The browser suite covers login, refresh persistence, filters, FIR preview, graph
paths and layouts, notes, file hashing, local sharing, alert actions, all four
report formats, history, distinct report types, maps, the assistant, invalid
routes, the complete guided tour, reset and mobile navigation. CCTV tests cover
camera filters, offline/maintenance states, pause/resume, PNG snapshots, saved
review flags, recording validation, actual local WebM playback, blob-URL cleanup
and mobile/reduced-motion behaviour. AI tests run the actual local model on the
synthetic clip, check multi-view playback and counts, validate that no identity
models or uploads are used, and exercise model-load failure/retry. Tracking tests cover manual camera
associations, order changes, export, replay, persistence, deletion and prevention
of replay against a replaced source. Fingerprint tests exercise actual SHA-256
matches/mismatches and WebAuthn registration/assertion verification with a browser
virtual authenticator, including cancellation, origin/account separation and
unsupported/embedded contexts. No physical fingerprint reader was used in the
automated tests; real hardware support must be checked on your device. It fails on
uncaught browser errors. It starts a demo server if one is not already running
on port 3000.

If browser downloads are restricted, an existing compatible Chromium can be
used with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium`. Supply any
system libraries required by that browser separately; none are app dependencies.

Static hosting must serve `index.html` as the fallback for client-side routes.
The demo is selected **at build time**. `npm run preview` does not turn a
real-backend bundle into a demo; build with `npm run build:demo` first.

## 5. Full-backend mode is separate

```bash
# Original Docker stack, not needed for the standalone demo:
bash start.sh

# Frontend development against a separately running FastAPI backend:
cd frontend
npm run dev
```

`npm run dev` / `npm run build` do not load `.env.demo`; demo mode is off by
default. Ensure `VITE_DEMO_MODE` is not explicitly set to `true` in your shell or
local environment files when using the real backend. Database/API failures never
silently activate the demo.

Vite binds to `0.0.0.0` and accepts preview hosts. Browser API requests use
same-origin paths; `/api`, `/health` and `/ws` are proxied to FastAPI on port 8000. The WebSocket client now uses the native JSON protocol expected by
FastAPI, rather than Socket.IO.

The backend still needs its databases, configuration and dependencies. The
ML, biometric, blockchain, IPFS, cyber-scanning and multi-agency integrations
are **not exercised by this standalone demo or its frontend tests**. Configure,
secure and validate the full stack independently before considering deployment.
Do not reuse demo credentials for production or distribute real `.env` / secret
files. There is no claim of government affiliation or production readiness.

## 6. Implementation map

```text
frontend/.env.demo             Explicit demo-mode flag
frontend/src/config/runtime.ts Mode and isolated session keys
frontend/src/demo/data.ts      Deterministic fictional dataset
frontend/src/demo/analysis.ts  Search, graph, BFS paths, components, FIR preview
frontend/src/demo/store.ts     Local persistence, bounded history, SHA-256
frontend/src/demo/reports.ts   Snapshot creation and real file rendering
frontend/src/demo/adapter.ts   Axios-compatible local endpoint implementation
frontend/src/demo/events.ts    Local alert and workspace-change events
frontend/src/demo/cctv.ts      Fictional camera catalogue
frontend/src/components/CCTV/ CCTV viewer, face boxes, manual review and event trails
frontend/src/utils/cctv*.ts    Recording registry, frame validation and snapshots
frontend/src/services/faceDetectionService.ts  Local model loading/inference
frontend/src/hooks/useFaceDetection.ts        Cancellable sampled video analysis
frontend/public/models/face-detector/         Detection-only weights + licence
frontend/public/demo/cctv-face-sample.webm     Synthetic example clip
frontend/tests/                Unit and transport regression tests
frontend/e2e/                  Browser workflow regression tests
start-demo.sh                  Node-only startup
```

The existing React/Redux screens use the same API service interface in either
mode. Unimplemented demo endpoints return explicit errors—never fake successful
responses. The full-stack backend source remains available in `backend/`.
