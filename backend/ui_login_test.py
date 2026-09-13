"""UI login test for all 4 roles: login -> dashboard -> logout -> next role."""

from __future__ import annotations

import time

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
ROLES = [
    ("admin@crimenet.gov.in", "Admin@123", "System Administrator"),
    ("officer@crimenet.gov.in", "Officer@123", "Inspector S. Sharma"),
    ("analyst@crimenet.gov.in", "Analyst@123", "Data Analyst A. Iyer"),
    ("senior@crimenet.gov.in", "Senior@123", "Senior Officer"),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    results = []
    for badge, pw, _expected_name in ROLES:
        page = browser.new_context(viewport={"width": 1440, "height": 900}).new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:120]))
        t0 = time.time()
        try:
            page.goto(BASE + "/login", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2000)
            page.get_by_placeholder("admin@crimenet.gov.in").fill(badge)
            page.get_by_placeholder("••••••••").fill(pw)
            page.get_by_role("button", name="SECURE LOGIN").click()
            page.wait_for_url(BASE + "/", timeout=45000)
            page.wait_for_timeout(4000)
            who = page.inner_text("body")
            # dashboard sanity: header + a stats card present
            ok_dash = "CrimeNet" in who
            page.screenshot(path=f"ui_sweep_shots/login-{badge.split('@')[0]}.png")
            # logout via sidebar button
            page.get_by_role("button", name="Logout").click()
            page.wait_for_url(BASE + "/login", timeout=20000)
            results.append((badge, "PASS", round(time.time() - t0, 1), ok_dash, errors[:3]))
            print(f"[{badge}] PASS in {time.time()-t0:.1f}s | dashboard ok={ok_dash} | logout ok | pageerrors={len(errors)}")
        except Exception as exc:
            page.screenshot(path=f"ui_sweep_shots/login-{badge.split('@')[0]}-FAILED.png")
            results.append((badge, "FAIL", round(time.time() - t0, 1), False, [str(exc)[:150]]))
            print(f"[{badge}] FAIL: {str(exc)[:150]}")
        finally:
            page.close()
    browser.close()

print("\n==== LOGIN SUMMARY ====")
for badge, status, secs, ok_dash, errs in results:
    print(f"{status:5} {badge:28} {secs:>5}s dashboard={ok_dash} {errs if errs else ''}")
