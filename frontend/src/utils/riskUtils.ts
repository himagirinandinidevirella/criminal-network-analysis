/**
 * Risk-level helpers shared across the UI.
 */
import type { RiskLevel } from "@/types/criminal.types";

/** Map a numeric risk score to a risk level (matches backend bands). */
export function levelFor(score: number): RiskLevel {
  if (score >= 81) return "CRITICAL";
  if (score >= 61) return "HIGH";
  if (score >= 31) return "MEDIUM";
  return "LOW";
}

/** Tailwind text colour class for a risk level. */
export function riskTextClass(level: RiskLevel | string): string {
  switch (level) {
    case "CRITICAL":
      return "text-risk-critical";
    case "HIGH":
      return "text-risk-high";
    case "MEDIUM":
      return "text-risk-medium";
    default:
      return "text-risk-low";
  }
}

/** Tailwind background class for a risk level. */
export function riskBgClass(level: RiskLevel | string): string {
  switch (level) {
    case "CRITICAL":
      return "bg-risk-critical";
    case "HIGH":
      return "bg-risk-high";
    case "MEDIUM":
      return "bg-risk-medium";
    default:
      return "bg-risk-low";
  }
}

/** Hex colour for a risk level (used in charts / graph). */
export function riskColor(level: RiskLevel | string): string {
  switch (level) {
    case "CRITICAL":
      return "#B3261E";
    case "HIGH":
      return "#C0551F";
    case "MEDIUM":
      return "#9A6A12";
    default:
      return "#1E7A55";
  }
}
