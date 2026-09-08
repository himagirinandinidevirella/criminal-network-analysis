import { useEffect, useRef, useState, type RefObject } from "react";
import {
  detectVideoFaces,
  loadFaceDetector,
} from "@/services/faceDetectionService";
import type {
  CameraDetectionState,
  FaceModelState,
} from "@/types/faceDetection.types";

export function useFaceDetectionModel(
  enabled: boolean,
  retry = 0,
): FaceModelState {
  const [state, setState] = useState<FaceModelState>({ status: "off" });
  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setState({ status: "off" });
      return;
    }
    setState({ status: "loading" });
    loadFaceDetector()
      .then(({ backend }) => {
        if (!cancelled) setState({ status: "ready", backend });
      })
      .catch(() => {
        if (!cancelled)
          setState({
            status: "error",
            error:
              "Could not load the local face detector. Check the model files or retry. Video playback still works.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, retry]);
  return enabled ? state : { status: "off" };
}

/** Samples visible videos only. Discards in-flight results after seeks, source swaps or disabling. */
export function useFaceDetection(
  videoRef: RefObject<HTMLVideoElement>,
  sourceKey: string,
  enabled: boolean,
  threshold: number,
  visible: boolean,
): CameraDetectionState {
  const initial = (): CameraDetectionState => ({
    sourceKey,
    status: enabled ? "waiting" : "off",
    frame: null,
  });
  const [state, setState] = useState<CameraDetectionState>(initial);
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
      setState({ sourceKey, status: "waiting", frame: null });
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
      if (lastTime === null)
        setState({ sourceKey, status: "scanning", frame: null });
      try {
        const frame = await detectVideoFaces(video, threshold, request.signal);
        if (!active || request.signal.aborted || version !== generation.current)
          return;
        // A seek/camera switch must not leave boxes from another frame on screen.
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
            error:
              "Could not analyse this frame. Try another video or restart detection.",
          });
          return;
        }
      } finally {
        if (active && version === generation.current)
          timer = setTimeout(tick, 650);
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
    ? { sourceKey, status: "off", frame: null }
    : state;
}
