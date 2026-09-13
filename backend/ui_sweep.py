"""
CrimeNet AI — full UI sweep with Playwright (Chromium, headless).

Logs in, visits every module page, exercises key interactions, and captures
per page: console errors, page errors, failed HTTP responses (>=400), and a
screenshot. Results: ui_sweep_report.json + PNGs in ui_sweep_shots/.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
SHOTS = Path(__file__).parent / "ui_sweep_shots"
SHOTS.mkdir(exist_ok=True)

report: list[dict] = []
current: dict = {}


def attach(page, name):
    current["console"] = []
    current["pageerrors"] = []
    current["bad_responses"] = []
    page.on("console", lambda m: current["console"].append(f"[{m.type}] {m.text[:200]}")
            if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: current["pageerrors"].append(str(e)[:200]))
    page.on("response", lambda r: current["bad_responses"].append(f"{r.status} {r.url[-80:]}")
            if r.status >= 400 else None)


def visit(page, path, name, wait_s=4.0, shot=True):
    current.update({"page": name, "path": path})
    t0 = time.time()
    try:
        page.goto(BASE + path, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(int(wait_s * 1000))
        if shot:
            page.screenshot(path=str(SHOTS / f"{name}.png"), full_page=False)
        report.append({
            "page": name, "path": path, "secs": round(time.time() - t0, 1),
            "title": page.title()[:60],
            "console": current["console"][:10],
            "pageerrors": current["pageerrors"][:5],
            "bad_responses": current["bad_responses"][:10],
        })
        print(f"[{name}] ok ({report[-1]['secs']}s) console={len(current['console'])} "
              f"pgerr={len(current['pageerrors'])} bad_http={len(current['bad_responses'])}")
    except Exception as exc:
        report.append({"page": name, "path": path, "error": str(e_limit(exc))})
        print(f"[{name}] EXCEPTION: {e_limit(exc)}")


def e_limit(e, n=160):
    s = str(e)
    return s[:n]


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    attach(page, "login")

    # ── 1. Login ────────────────────────────────────────────────────────────
    visit(page, "/login", "01-login", wait_s=3)
    try:
        page.get_by_placeholder("admin@crimenet.gov.in").fill("admin@crimenet.gov.in")
        page.get_by_placeholder("••••••••").fill("Admin@123")
        page.get_by_role("button", name="SECURE LOGIN").click()
        page.wait_for_url(BASE + "/", timeout=45000)
        page.wait_for_timeout(5000)
        page.screenshot(path=str(SHOTS / "02-dashboard.png"))
        report.append({"page": "02-login-action", "path": "/login→/", "ok": True,
                       "console": current["console"][:10],
                       "pageerrors": current["pageerrors"][:5],
                       "bad_responses": current["bad_responses"][:10]})
        print("[login-action] logged in, dashboard loaded")
    except Exception as exc:
        page.screenshot(path=str(SHOTS / "02-login-FAILED.png"))
        report.append({"page": "02-login-action", "error": e_limit(exc, 300)})
        print(f"[login-action] FAILED: {e_limit(exc, 300)}")

    # ── 2. Static module pages ──────────────────────────────────────────────
    visit(page, "/overview", "03-overview", wait_s=4)
    visit(page, "/network", "04-network", wait_s=8)
    visit(page, "/investigation", "05-investigation", wait_s=4)
    visit(page, "/alerts", "06-alerts", wait_s=4)
    visit(page, "/reports", "07-reports", wait_s=4)
    visit(page, "/map", "08-crime-map", wait_s=6)
    visit(page, "/blockchain", "09-blockchain", wait_s=4)
    visit(page, "/settings", "10-settings", wait_s=3)
    visit(page, "/fingerprints", "11-fingerprints", wait_s=4)
    visit(page, "/public", "12-public", wait_s=4)

    # ── 3. Criminal profile (real id from API) ──────────────────────────────
    try:
        import httpx
        tok = httpx.post("http://127.0.0.1:8000/api/auth/login",
                         json={"badge_id": "admin@crimenet.gov.in", "password": "Admin@123"},
                         timeout=30).json()["data"]["access_token"]
        items = httpx.get("http://127.0.0.1:8000/api/criminals/?limit=1",
                          headers={"Authorization": f"Bearer {tok}"},
                          timeout=30).json()["data"]["items"]
        if items:
            cid = items[0]["id"]
            visit(page, f"/criminal/{cid}", "13-criminal-profile", wait_s=6)
        else:
            report.append({"page": "13-criminal-profile", "error": "no criminals in DB"})
    except Exception as exc:
        report.append({"page": "13-criminal-profile", "error": e_limit(exc, 200)})

    # ── 4. Network Analysis: Path Finder interaction ────────────────────────
    try:
        page.goto(BASE + "/network", wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(8000)
        from_sel = page.get_by_role("combobox", name="From criminal")
        to_sel = page.get_by_role("combobox", name="To criminal")
        if from_sel.count() == 1 and to_sel.count() == 1:
            opts = from_sel.locator("option").all_text_contents()
            from_sel.select_option(label=[o for o in opts if o and "Select" not in o][0])
            opts2 = to_sel.locator("option").all_text_contents()
            to_sel.select_option(label=[o for o in opts2 if o and "Select" not in o and
                                        o != [x for x in opts if o and "Select" not in o][0]][0])
            page.wait_for_timeout(500)
            btn = page.get_by_role("button", name="FIND CONNECTION")
            btn.click(timeout=8000)
            page.wait_for_timeout(5000)
            found = "Path:" in page.inner_text("body")
            page.screenshot(path=str(SHOTS / "14-pathfinder.png"))
            report.append({"page": "14-pathfinder", "ok": found,
                           "result": "Path found" if found else "no path text"})
            print(f"[pathfinder] {'OK' if found else 'NO RESULT'}")
        else:
            report.append({"page": "14-pathfinder", "error":
                           f"dropdowns not found (from={from_sel.count()}, to={to_sel.count()})"})
            print("[pathfinder] dropdowns missing")
    except Exception as exc:
        page.screenshot(path=str(SHOTS / "14-pathfinder-FAILED.png"))
        report.append({"page": "14-pathfinder", "error": e_limit(exc, 300)})
        print(f"[pathfinder] FAILED: {e_limit(exc, 300)}")

    # ── 5. AI Assistant: intent + LLM ───────────────────────────────────────
    def chat_ui(query: str, tag: str, max_wait_s: int = 40):
        try:
            page.goto(BASE + "/chat", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)
            tb = page.get_by_placeholder("Type your question…")
            tb.fill(query)
            tb.press("Enter")
            page.wait_for_timeout(max_wait_s * 1000)
            body = page.inner_text("body")
            got = len(body) > 1500  # reply rendered beyond shell chrome
            page.screenshot(path=str(SHOTS / f"{tag}.png"))
            report.append({"page": tag, "query": query,
                           "reply_seen": got, "body_len": len(body)})
            print(f"[{tag}] reply_seen={got} body_len={len(body)}")
        except Exception as exc:
            page.screenshot(path=str(SHOTS / f"{tag}-FAILED.png"))
            report.append({"page": tag, "error": e_limit(exc, 300)})
            print(f"[{tag}] FAILED: {e_limit(exc, 300)}")

    chat_ui("top 5 highest risk criminals", "15-chat-intent", max_wait_s=15)
    chat_ui("Explain how to prioritise suspects for surveillance", "16-chat-llm", max_wait_s=45)

    # ── 6. Investigation: FIR analysis via UI ───────────────────────────────
    try:
        page.goto(BASE + "/investigation?mode=fir", wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(4000)
        ta = page.get_by_label("FIR document")
        btn = page.get_by_role("button", name="ANALYZE FIR")
        clicked = False
        if ta.count() == 1 and btn.count() == 1:
            ta.fill("FIR No: 99/2024. Suspect Vikram Rao was seen at Andheri, Mumbai with Meena Patil. "
                    "Vehicle MH-03-CD-1111 used in the escape.")
            btn.click(timeout=5000)
            clicked = True
            page.wait_for_timeout(20000)
        page.screenshot(path=str(SHOTS / "17-investigation-fir.png"))
        report.append({"page": "17-investigation-fir", "clicked": clicked,
                       "console": current["console"][:10],
                       "bad_responses": current["bad_responses"][:10]})
        print(f"[investigation-fir] clicked={clicked}")
    except Exception as exc:
        report.append({"page": "17-investigation-fir", "error": e_limit(exc, 300)})
        print(f"[investigation-fir] FAILED: {e_limit(exc, 300)}")

    browser.close()

# ── Summary ──────────────────────────────────────────────────────────────────
Path("ui_sweep_report.json").write_text(json.dumps(report, indent=2))
fails = [r for r in report if r.get("error") or (r.get("pageerrors")) or
         (r.get("status") is False)]
print("\n==== SUMMARY ====")
print(f"entries: {len(report)} | with errors: {len(fails)}")
for r in fails:
    print(" -", r.get("page"), "->", (r.get("error") or r.get("pageerrors") or "")[:120])
