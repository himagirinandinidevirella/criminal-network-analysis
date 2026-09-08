import {
  useEffect,
  useRef,
  useState,
  type RefObject,
  type MutableRefObject,
} from "react";
import type { CCTVCamera } from "@/types/cctv.types";
import { drawCCTVSimulation } from "@/utils/cctvRenderer";

interface Props {
  camera: CCTVCamera;
  paused: boolean;
  canvasRef: RefObject<HTMLCanvasElement>;
  onTime: (seconds: number) => void;
  onReady: () => void;
  onError: (message: string) => void;
  seekRef?: MutableRefObject<((seconds: number) => void) | null>;
}

/** Only the selected feed renders. Animation stops off-screen, in hidden tabs, or when paused. */
export default function SimulatedCCTVFeed({
  camera,
  paused,
  canvasRef,
  onTime,
  onReady,
  onError,
  seekRef,
}: Props) {
  const seconds = useRef(0);
  const callbacks = useRef({ onTime, onReady, onError });
  callbacks.current = { onTime, onReady, onError };
  const [visible, setVisible] = useState(true);
  const [tabVisible, setTabVisible] = useState(!document.hidden);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([entry]) =>
            setVisible(entry.isIntersecting),
          )
        : null;
    observer?.observe(canvas);
    const updateVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, [canvasRef]);

  useEffect(() => {
    seconds.current = 0;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) {
      callbacks.current.onError(
        "Canvas is unavailable in this browser. Try opening a local recording instead.",
      );
      return;
    }
    drawCCTVSimulation(ctx, camera, 0);
    canvas.dataset.elapsed = "0";
    callbacks.current.onTime(0);
    callbacks.current.onReady();
    if (seekRef)
      seekRef.current = (value: number) => {
        seconds.current = value;
        drawCCTVSimulation(ctx, camera, value);
        canvas.dataset.elapsed = String(value);
        callbacks.current.onTime(value);
      };
    return () => {
      if (seekRef) seekRef.current = null;
    };
  }, [camera, canvasRef, seekRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || paused || !visible || !tabVisible) return;
    let frame = 0,
      previous = performance.now(),
      lastDraw = 0,
      lastNotified = -1;
    const draw = (now: number) => {
      seconds.current += Math.min((now - previous) / 1000, 0.25);
      previous = now;
      if (now - lastDraw >= 1000 / 12) {
        drawCCTVSimulation(ctx, camera, seconds.current);
        canvas.dataset.elapsed = String(seconds.current);
        lastDraw = now;
        const wholeSecond = Math.floor(seconds.current);
        if (wholeSecond !== lastNotified) {
          callbacks.current.onTime(wholeSecond);
          lastNotified = wholeSecond;
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [camera, canvasRef, paused, visible, tabVisible]);

  return (
    <canvas
      ref={canvasRef}
      width={960}
      height={540}
      className="h-full w-full object-contain"
      role="img"
      aria-label={`Simulated CCTV view: ${camera.name}. Fictional animated scene, not live footage.`}
    />
  );
}
