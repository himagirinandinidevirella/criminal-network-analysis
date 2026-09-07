/**
 * useWebSocket — connect to the real-time alert stream and subscribe.
 */
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { alertSocket } from "@/services/websocket";
import { pushAlert } from "@/store/alertSlice";

/**
 * Connect to the alert WebSocket and dispatch incoming alerts to the store.
 * @param criminalIds optional subscription targets
 */
export function useWebSocket(criminalIds?: string[]): void {
  const dispatch = useDispatch();

  useEffect(() => {
    alertSocket.connect();
    const unsubscribe = alertSocket.onAlert((alert) => {
      dispatch(pushAlert(alert));
    });
    if (criminalIds?.length) {
      alertSocket.subscribe(criminalIds);
    }
    return () => {
      unsubscribe();
    };
  }, [criminalIds?.join(","), dispatch]);
}
