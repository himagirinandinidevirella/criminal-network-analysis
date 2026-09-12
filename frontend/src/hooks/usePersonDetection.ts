import { useEffect, useState } from "react";
import { loadPersonDetector } from "@/services/personDetectionService";

export type PersonModelStatus =
  | "disabled"
  | "loading"
  | "ready"
  | "error";

export interface PersonModelContext {
  status: PersonModelStatus;
  error?: string;
}

export function usePersonDetectionModel(
  enabled: boolean,
  retryKey: number
): PersonModelContext {
  const [context, setContext] = useState<PersonModelContext>({
    status: "disabled",
  });

  useEffect(() => {
    if (!enabled) {
      setContext({ status: "disabled" });
      return;
    }

    let active = true;
    setContext({ status: "loading" });

    loadPersonDetector()
      .then(() => {
        if (active) setContext({ status: "ready" });
      })
      .catch((error) => {
        if (active)
          setContext({
            status: "error",
            error: error instanceof Error ? error.message : "Load failed",
          });
      });

    return () => {
      active = false;
    };
  }, [enabled, retryKey]);

  return context;
}

import { useRef, type RefObject } from "react";
import { detectVideoPersons } from "@/services/personDetectionService";
import type { CameraPersonDetectionState } from "@/types/personDetection.types";

export function usePersonDetection(
  videoRef: RefObject<HTMLVideoElement>,
  sourceKey: string,
  enabled: boolean,
  threshold: number,
  visible: boolean
): CameraPersonDetectionState {
  const initial = (): CameraPersonDetectionState => ({
    sourceKey,
    status: enabled ? "ready" : "idle",
    frame: null,
  });
  
  const [state, setState] = useState<CameraPersonDetectionState>(initial);
  const generation = useRef(0);

  useEffect(() => {
    const video = videoRef.current;
    let active = true,
      timer: ReturnType<typeof setTimeout> | undefined,
      controller = new AbortController();
    let lastTime: number | null = null;
    const version = ++generation.current;
    
    setState(initial());
    if (!enabled || !visible || !video) return;

    const invalidate = () => {
      controller.abort();
      controller = new AbortController();
      lastTime = null;
      setState({ sourceKey, status: "ready", frame: null });
    };

    const tick = async () => {
      if (!active || version !== generation.current) return;
      if (
        document.hidden ||
        video.seeking ||
        video.readyState < 2 ||
        (video.paused && lastTime === video.currentTime)
      ) {
        timer = setTimeout(tick, 400);
        return;
      }

      const request = controller;
      try {
        const frame = await detectVideoPersons(video, threshold, request.signal);
        if (!active || request.signal.aborted || version !== generation.current)
          return;

        if (Math.abs(video.currentTime - frame.sourceTime) <= 1.2) {
          lastTime = frame.sourceTime;
          setState({ sourceKey, status: "ready", frame });
        }
      } catch (error) {
        if (!active || request.signal.aborted || version !== generation.current)
          return;
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState({
            sourceKey,
            status: "error",
            frame: null,
            error: "Frame analysis failed.",
          });
          return;
        }
      } finally {
        if (active && version === generation.current) {
          // Suitable interval to avoid performance issues (1 second)
          timer = setTimeout(tick, 1000);
        }
      }
    };

    const onVisibility = () => {
      if (document.hidden) invalidate();
    };

    video.addEventListener("seeking", invalidate);
    video.addEventListener("emptied", invalidate);
    document.addEventListener("visibilitychange", onVisibility);
    tick();

    return () => {
      active = false;
      controller.abort();
      generation.current++;
      clearTimeout(timer);
      video.removeEventListener("seeking", invalidate);
      video.removeEventListener("emptied", invalidate);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [videoRef, sourceKey, enabled, threshold, visible]);

  return !enabled || !visible || state.sourceKey !== sourceKey
    ? { sourceKey, status: "idle", frame: null }
    : state;
}
