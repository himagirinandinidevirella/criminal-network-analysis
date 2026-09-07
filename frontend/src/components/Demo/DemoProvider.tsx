/**
 * DemoProvider — owns the guided demo state machine and renders the overlay.
 *
 * Wraps the whole app so the Login page can start the tour and the overlay can
 * stay mounted across route transitions.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { AppDispatch } from "@/store";
import { loginThunk } from "@/store/authSlice";
import { analyzeFir } from "@/store/criminalSlice";
import { DemoContext, DEMO_FIR, DEMO_STEPS } from "@/hooks/useDemoMode";
import { findCriminalIdByName, triggerDemoAlert } from "@/services/demoService";
import DemoOverlay from "./DemoOverlay";

/** Per-step durations (seconds) matching the SIH 2025 demo scenario (~5 min). */
const STEP_DURATIONS: Record<number, number> = {
  1: 30, // Dashboard overview
  2: 45, // FIR analysis
  3: 60, // Network exploration
  4: 45, // Risk & anomaly
  5: 30, // Predictions
  6: 30, // Live alert
  7: 30, // AI chatbot
  8: 30, // Report generation
};

export default function DemoProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [rajaId, setRajaId] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const exit = useCallback(() => {
    clearTimer();
    setActive(false);
    setStepIndex(0);
    setPaused(false);
    navigate("/");
    toast("Demo mode exited", { icon: "⏹️" });
  }, [navigate]);

  const startDemo = useCallback(async () => {
    toast("Starting 5-minute guided demo…", { icon: "▶️" });
    try {
      // Auto-login as the demo admin account.
      await dispatch(
        loginThunk({
          badge_id: "admin@crimenet.gov.in",
          password: "Admin@123",
          department: "Ministry of Home Affairs",
        })
      ).unwrap();
    } catch {
      toast.error("Demo requires a running backend — run `bash start.sh` first");
      return;
    }
    setRajaId(null);
    setStepIndex(0);
    setPaused(false);
    setActive(true);
    navigate("/");
  }, [dispatch, navigate]);

  const next = useCallback(() => {
    setStepIndex((i) => i + 1);
  }, []);

  const togglePause = useCallback(() => setPaused((p) => !p), []);

  // End the tour once we advance past the final step.
  useEffect(() => {
    if (active && stepIndex >= DEMO_STEPS.length) {
      exit();
    }
  }, [active, stepIndex, exit]);

  // ── Per-step actions: drive the app, fetch data, trigger effects ──────────
  useEffect(() => {
    if (!active || stepIndex >= DEMO_STEPS.length) return;
    const step = DEMO_STEPS[stepIndex];
    let cancelled = false;

    (async () => {
      try {
        switch (step.id) {
          case 2: {
            // FIR auto-analysis: run extraction, then show the results page.
            await dispatch(analyzeFir({ fir_text: DEMO_FIR, language: "en" })).unwrap();
            break;
          }
          case 4:
          case 5: {
            // Open Raja Khan's profile (resolves his id once via search).
            let id = rajaId;
            if (!id) {
              id = await findCriminalIdByName("Raja Khan");
              if (id && !cancelled) setRajaId(id);
            }
            if (id && !cancelled) {
              navigate(`/criminal/${id}`);
              return; // keep the profile on screen for these steps
            }
            break;
          }
          case 6: {
            // Navigate first so the alert dashboard (flash/sound) is mounted,
            // then fire the simulated alert over the WebSocket.
            if (!cancelled) navigate("/alerts");
            await new Promise((r) => setTimeout(r, 1200));
            if (!cancelled) await triggerDemoAlert();
            return;
          }
          default:
            break;
        }
        if (!cancelled) navigate(step.route);
      } catch {
        if (!cancelled) navigate(step.route);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex]);

  // ── Auto-advance timer (skipped while paused) ──────────────────────────────
  useEffect(() => {
    clearTimer();
    if (!active || paused || stepIndex >= DEMO_STEPS.length) return;
    const step = DEMO_STEPS[stepIndex];
    const seconds = STEP_DURATIONS[step.id] ?? 20;
    timerRef.current = window.setTimeout(() => {
      setStepIndex((i) => i + 1);
    }, seconds * 1000);
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex, paused]);

  const value = { active, stepIndex, paused, steps: DEMO_STEPS, startDemo, togglePause, next, exit };

  return (
    <DemoContext.Provider value={value}>
      {children}
      {active && <DemoOverlay />}
    </DemoContext.Provider>
  );
}
