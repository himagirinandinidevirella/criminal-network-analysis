import type { CCTVCamera } from "@/types/cctv.types";

/** Fictional camera catalogue, separate from the person graph and its risk scores. */
export const DEMO_CCTV_CAMERAS: CCTVCamera[] = [
  {
    id: "CAM-01",
    name: "Junction overview",
    location: "Demo sector A · Road junction",
    status: "AVAILABLE",
    scene: "junction",
    notice:
      "Animated fictional scene. No physical camera or live stream is connected.",
  },
  {
    id: "CAM-02",
    name: "Warehouse perimeter",
    location: "Demo sector B · Loading area",
    status: "AVAILABLE",
    scene: "warehouse",
    notice:
      "Animated fictional scene. No physical camera or live stream is connected.",
  },
  {
    id: "CAM-03",
    name: "Transit entry",
    location: "Demo sector C · Entry checkpoint",
    status: "OFFLINE",
    scene: "junction",
    notice:
      "Simulated connection loss. This demo camera has no available footage.",
  },
  {
    id: "CAM-04",
    name: "Service gate",
    location: "Demo sector D · Service lane",
    status: "MAINTENANCE",
    scene: "warehouse",
    notice:
      "Simulated maintenance window. This demo camera has no available footage.",
  },
];
