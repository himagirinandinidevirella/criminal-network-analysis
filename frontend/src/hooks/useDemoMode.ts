import { IS_DEMO } from "@/config/runtime";
/**
 * useDemoMode — context hook + step definitions for the guided demo tour
 * (SIH 2025 Section 13).
 */
import { createContext, useContext } from "react";

export interface DemoStep {
  id: number;
  title: string;
  description: string;
  narration: string;
  route: string;
}

/** The eight demo steps matching the SIH 2025 demo scenario. */
const FULL_STACK_STEPS: DemoStep[] = [
  {
    id: 1,
    title: "Dashboard Overview",
    description: "Live statistics · network preview · active alerts",
    narration:
      "Welcome to CrimeNet AI. This command dashboard shows live statistics across the synthetic criminal network — 500 tracked persons, active investigations, the network preview, and the most recent alerts.",
    route: "/",
  },
  {
    id: 2,
    title: "FIR Analysis",
    description: "Multilingual BERT + spaCy entity extraction",
    narration:
      "Here we analyse a sample FIR about Raja Khan. Watch the NLP engine extract persons, locations, vehicles, accounts and organizations in real time, then update the Neo4j knowledge graph automatically.",
    route: "/investigation",
  },
  {
    id: 3,
    title: "Network Exploration",
    description: "Interactive Cytoscape network map",
    narration:
      "This is the interactive network map. Nodes are coloured by risk and sized by centrality. Zoom into the Mumbai drug network, click Raja Khan, and follow the hidden link to the Eastern Syndicate.",
    route: "/network",
  },
  {
    id: 4,
    title: "Risk & Anomaly Analysis",
    description: "XGBoost + SHAP risk score · anomaly detection",
    narration:
      "Raja Khan scores 95 out of 100 on the risk engine. The SHAP chart shows his top factors — network centrality, prior arrests and gang leadership — alongside a ₹45 lakh financial anomaly spike.",
    route: "/investigation",
  },
  {
    id: 5,
    title: "Predictions",
    description: "LSTM + Random Forest crime predictor",
    narration:
      "The crime predictor forecasts an 87% recidivism probability within 30 days, with drug trafficking as the predicted crime type and Mumbai as the predicted location.",
    route: "/investigation",
  },
  {
    id: 6,
    title: "Live Alert",
    description: "Real-time WebSocket alert · flash + sound",
    narration:
      "Now a critical alert fires in real time. Watch the red flash, hear the alert sound, see the toast notification, and watch the badge counter increment.",
    route: "/alerts",
  },
  {
    id: 7,
    title: "AI Chatbot",
    description: "Natural-language intelligence queries",
    narration:
      "The AI assistant answers natural-language questions over the knowledge graph. We ask who Raja Khan's top associates are and receive a structured, ranked response.",
    route: "/chat",
  },
  {
    id: 8,
    title: "Report Generation",
    description: "Watermarked, classified PDF report",
    narration:
      "Finally, we generate a full criminal profile report — a watermarked, classified PDF built by the ReportLab engine and logged to the report history.",
    route: "/reports",
  },
];

/** The standalone tour describes the actual browser implementation. */
export const DEMO_STEPS: DemoStep[] = IS_DEMO
  ? [
      {
        id: 1,
        title: "Dashboard",
        description: "40 fictional people · 112 entities",
        narration:
          "This workspace is fully synthetic and stored in this browser. Review the sample statistics and explore the interactive graph. No real case database, crime-prediction model or blockchain service is connected. Optional CCTV face detection runs locally and does not identify people.",
        route: "/",
      },
      {
        id: 2,
        title: "FIR entity preview",
        description: "Dictionary matching + identifier patterns",
        narration:
          "The sample FIR is matched against fictional records. This preview finds known names and identifier patterns; it does not run BERT, infer guilt, or create new graph records.",
        route: "/investigation?mode=fir",
      },
      {
        id: 3,
        title: "Explore the graph",
        description: "Inspect · filter · shortest paths · what-if",
        narration:
          "Choose an entity, combine filters, find a path between Raja Khan and Vikram Rao, or remove a node in a temporary structural simulation. Paths are calculated from the actual fixture edges.",
        route: "/network?node=raja-khan",
      },
      {
        id: 4,
        title: "Review a profile",
        description: "Sample score · accounts · associates · notes",
        narration:
          "Raja Khan is a fictional record with an illustrative score of 95. This is not an AI risk prediction. Try the tabs and add a local note, verification or priority flag using the actions bar.",
        route: "/criminal/raja-khan",
      },
      {
        id: 5,
        title: "Integrity Lab",
        description: "Real SHA-256 · no blockchain",
        narration:
          "Save a reference checksum, change the sample text, then compare. A mismatch detects a content change, not who made it. The lab is a cryptography demonstration, not a court-admissibility check.",
        route: "/blockchain",
      },
      {
        id: 6,
        title: "Local alert event",
        description: "Trigger · assign · escalate · resolve",
        narration:
          "A manually triggered sample alert arrives through the local event bus. Open it, assign it to yourself, escalate it or resolve it. Notification preferences are available in Settings.",
        route: "/alerts",
      },
      {
        id: 7,
        title: "Demo assistant",
        description: "Rule-based queries over synthetic records",
        narration:
          "The local assistant can look up profiles, associates, paths, sample scores and transactions. It is not an LLM. Try the suggested questions; unsupported questions receive an explanation of its limits.",
        route: "/chat?q=Who%20are%20Raja%20Khan%27s%20top%20associates%3F",
      },
      {
        id: 8,
        title: "Download a report",
        description: "PDF · CSV · XLSX · JSON",
        narration:
          "Select sections and a format, then Generate report to download an actual file. Every export carries a synthetic-data notice. Report History keeps snapshots locally so they can be downloaded again.",
        route: "/reports?criminal=raja-khan",
      },
    ]
  : FULL_STACK_STEPS;

/** Sample FIR used by the demo's auto-analysis step. */
export const DEMO_FIR = `FIR No: 042/2024
Raja Khan, aged 38, of Dharavi, Mumbai, is the leader of the Mumbai Drug Syndicate. He was seen in a black BMW MH-01-AX-9999 with Shyam Verma. A suspicious transfer of Rs. 45,00,000 from account XXXX1234 at State Bank of India (IFSC SBIN0001234) was flagged. Meena Patil manages hawala operations.`;

export interface DemoContextValue {
  active: boolean;
  stepIndex: number;
  paused: boolean;
  steps: DemoStep[];
  startDemo: () => void;
  togglePause: () => void;
  next: () => void;
  exit: () => void;
}

/** Context provided by <DemoProvider> wrapping the app. */
export const DemoContext = createContext<DemoContextValue | null>(null);

/** Access the demo controller from any component. */
export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used within a DemoProvider");
  return ctx;
}
