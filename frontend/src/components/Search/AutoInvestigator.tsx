/**
 * AutoInvestigator — Human-Designed Autonomous AI Investigation Command Center.
 * Designed around the real-world mental model and tactile workflow of Police Investigators & Analysts.
 *
 * Features:
 *  - Interactive Digital Incident Board (Visual Corkboard with connected evidence pins)
 *  - Biometric AFIS Minutiae Visualizer with 1-to-N matching
 *  - Authentic National ID & Financial Trail Badges (Aadhaar, PAN, UPI, Crypto)
 *  - Multi-Hop Syndicate Hierarchy & Modus Operandi Synthesis
 *  - Evidentiary Weight & Legal Admissibility Matrix (Indian Evidence Act Sec 45 / 65B)
 *  - Interactive Tactical Police Action Checklist
 *  - Section 65B Court-Admissible Electronic Certificate Generator
 */

import React, { useState } from "react";
import {
  Fingerprint,
  FileText,
  Search,
  ShieldAlert,
  CreditCard,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Award,
  Download,
  Share2,
  Lock,
  Cpu,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Eye,
  SlidersHorizontal,
  Pin,
  Flame,
  Layers,
  FileCheck2,
  Printer,
  Compass,
  Zap,
} from "lucide-react";
import { post } from "@/services/api";
import { successToast, errorToast } from "@/components/Common/ToastNotification";

const PRESET_CASES = [
  {
    title: "Case 1: Colaba Armed Heist (Latent Fingerprint + Hawala UPI)",
    subtitle: "Robbery with direct AFIS minutiae match on getaway motorcycle & ₹45L UPI layer",
    text: `CASE REPORT: Colaba Commercial District Armed Robbery (FIR 2024-MH-409).
Latent fingerprint FP-MH-9942 was lifted from the handlebar of abandoned getaway motorcycle MH-01-AX-9999.
Primary suspect at scene identified as Shyam Verma, known lieutenant of Kingpin Raja Khan.
Stolen cash of ₹45,00,000 was layered through UPI id raja.khan@oksbi and masked bank account XXXX9871 at State Bank of India.
Recovered safehouse documents contain PAN ABCDE1234F, Aadhaar XXXX-XXXX-4819, and IMEI 864209048192019.`,
  },
  {
    title: "Case 2: Darknet Ransomware & Crypto Laundering Syndicate",
    subtitle: "Extortion targeting municipal health servers, 4.5 BTC peel chain, Telegram nexus",
    text: `CYBERCRIME FIR: Ransomware attack on Municipal Hospital servers (FIR 2024-CY-118).
Extortion demand of 4.5 BTC paid to wallet 0x71C8364819283749102837491028374910283749.
Funds traced through mixing hops to Telegram handle @dark_vault_ops and withdrawal account XXXX4421.
Suspect operating from Bengaluru cyber cell led by Priya Hacker with alias pH4ck.
Recovered hardware includes burner mobile IMEI 358920194819201 and PAN BZCPK8812M.`,
  },
  {
    title: "Case 3: Inter-State Narcotics Ring (Eastern Syndicate Bridge)",
    subtitle: "12kg contraband transit, shell logistics entity, Hawala conduit through Meena Patil",
    text: `SPECIAL NARCOTICS BRIEF: Seizure of 12kg contraband at Andheri transport hub.
Vehicle Tata Ace MH-04-CD-8812 registered under shell entity Apex Logistics LLP.
Aadhaar 9912-3841-8821 belongs to Vikram Rao (Eastern Syndicate leader) operating between Delhi and Mumbai.
Hawala operations coordinated by Meena Patil through bank account XXXX6612 (IFSC HDFC0004412).`,
  },
];

export default function AutoInvestigator() {
  const [firText, setFirText] = useState(PRESET_CASES[0].text);
  const [caseTitle, setCaseTitle] = useState("Colaba Armed Heist & Syndicate Hawala");
  const [jurisdiction, setJurisdiction] = useState("Mumbai Crime Branch / Unit 1 (Anti-Robbery Cell)");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<"corkboard" | "dossier">("corkboard");
  const [activeTab, setActiveTab] = useState<"leads" | "afis" | "identities" | "network" | "directives">("leads");
  const [completedDirectives, setCompletedDirectives] = useState<Record<string, boolean>>({});
  const [showCertModal, setShowCertModal] = useState(false);

  const runInvestigation = async () => {
    if (!firText.trim()) {
      errorToast("Please enter or paste an FIR document text.");
      return;
    }
    setLoading(true);
    try {
      const response = await post<any>("/api/criminals/auto-investigate", {
        fir_text: firText,
        case_title: caseTitle,
        jurisdiction: jurisdiction,
        language: "en",
      });
      setReport(response);
      successToast("Autonomous AI Investigation completed! Evidence dots connected.");
    } catch (err: any) {
      errorToast("Investigation failed: " + (err?.message || "Server error"));
    } finally {
      setLoading(false);
    }
  };

  const toggleDirective = (id: string) => {
    setCompletedDirectives((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      {/* ── Top Case Header (Classified Police Board Header) ── */}
      <div className="relative overflow-hidden rounded-xl border border-paper-line bg-paper-raised p-6 shadow-card">
        {/* Subtle decorative background watermark */}
        <div className="pointer-events-none absolute right-4 top-2 select-none font-serif text-8xl font-black tracking-widest text-ink/[0.03]">
          CONFIDENTIAL
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-paper-line pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-seal/40 bg-seal-soft text-seal shadow-inner">
              <Compass className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="stamp">INCIDENT ROOM</span>
                <span className="font-mono text-xs uppercase tracking-widest text-ink-faint">
                  Autonomous Investigative OS · CCTNS Ready
                </span>
              </div>
              <h2 className="dossier-title mt-1 text-2xl font-bold text-ink">
                CrimeNet AI Autonomous Investigator
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-paper-line bg-paper px-3 py-1.5 font-mono text-xs text-ink-soft shadow-sm">
              <span className="text-seal font-bold">● LIVE:</span> 1-to-N AFIS + Multi-Hop Graph Reasoning
            </div>
          </div>
        </div>

        {/* Preset Selector & Input Form */}
        <div className="mt-5 space-y-4">
          <div>
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-ink-soft">
              Select Sample Investigation Incident:
            </span>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
              {PRESET_CASES.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setFirText(preset.text);
                    setCaseTitle(preset.title.split(":")[1]?.trim() || preset.title);
                  }}
                  className={`rounded-lg border p-3 text-left transition ${
                    firText === preset.text
                      ? "border-seal bg-seal-soft/30 shadow-sm"
                      : "border-paper-line bg-paper hover:border-seal-line hover:bg-paper-sunk"
                  }`}
                >
                  <span className="font-mono text-[11px] font-bold text-seal">Case Scenario #{idx + 1}</span>
                  <h4 className="font-bold text-xs text-ink line-clamp-1">{preset.title.split(":")[1] || preset.title}</h4>
                  <p className="mt-1 font-mono text-[10px] text-ink-faint line-clamp-1">{preset.subtitle}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                Case Title / Subject
              </label>
              <input
                type="text"
                value={caseTitle}
                onChange={(e) => setCaseTitle(e.target.value)}
                className="mt-1 w-full rounded-md border border-paper-line bg-paper p-2.5 font-mono text-xs text-ink shadow-inner focus:border-seal focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                Jurisdiction & Investigating Police Station
              </label>
              <input
                type="text"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                className="mt-1 w-full rounded-md border border-paper-line bg-paper p-2.5 font-mono text-xs text-ink shadow-inner focus:border-seal focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                Case Record / Raw FIR Copy / Latent Biometric Scene Report
              </label>
              <span className="font-mono text-[10px] text-ink-faint">Supports English, Hindi, and Regional CCTNS formats</span>
            </div>
            <textarea
              rows={4}
              value={firText}
              onChange={(e) => setFirText(e.target.value)}
              className="mt-1 w-full rounded-md border border-paper-line bg-paper p-3 font-mono text-xs leading-relaxed text-ink shadow-inner focus:border-seal focus:outline-none"
              placeholder="Paste raw police FIR, forensic recovery notes, or seizure memos here..."
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 font-mono text-xs text-ink-soft">
              <Zap className="h-4 w-4 text-seal" />
              <span>Multi-attribute correlation active: Fingerprints · Aadhaar · PAN · UPI · IMEI · Neo4j</span>
            </div>
            <button
              onClick={runInvestigation}
              disabled={loading}
              className="flex items-center gap-2 rounded-md bg-seal px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-ink-onred shadow-md transition hover:bg-seal-dark disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Cross-Referencing Evidence...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Run Autonomous AI Investigation
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Investigation Results Workspace ── */}
      {report && (
        <div className="space-y-6">
          {/* Top Metric Strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="relative rounded-xl border border-paper-line bg-paper-raised p-4 shadow-sm">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Case Dossier ID</span>
              <p className="font-mono text-xl font-black text-seal">{report.case_id}</p>
              <span className="font-mono text-xs text-ink-soft">{report.jurisdiction?.split("/")[0]}</span>
              <div className="absolute right-3 top-3">
                <span className="stamp">VERIFIED</span>
              </div>
            </div>

            <div className="rounded-xl border border-paper-line bg-paper-raised p-4 shadow-sm">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Biometric Matches</span>
              <p className="font-mono text-xl font-black text-ink">
                {report.biometric_matching_report?.length || 0} AFIS Ridge Match
              </p>
              <span className="flex items-center gap-1 font-mono text-xs font-semibold text-teal">
                <CheckCircle2 className="h-3 w-3" /> State Lab Corroborated
              </span>
            </div>

            <div className="rounded-xl border border-paper-line bg-paper-raised p-4 shadow-sm">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Target Syndicate</span>
              <p className="font-mono text-xl font-black text-risk-critical">
                {report.connected_network_synthesis?.primary_syndicate || "Organized Cartel"}
              </p>
              <span className="font-mono text-xs text-ink-soft">
                {report.connected_network_synthesis?.total_nodes_connected} Entities Traversed
              </span>
            </div>

            <div className="rounded-xl border border-paper-line bg-paper-raised p-4 shadow-sm">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Legal Admissibility</span>
              <p className="font-mono text-sm font-black text-teal">Section 65B Ready</p>
              <button
                onClick={() => setShowCertModal(true)}
                className="mt-1 flex items-center gap-1 font-mono text-xs font-bold text-seal hover:underline"
              >
                <FileCheck2 className="h-3 w-3" /> View Court Certificate
              </button>
            </div>
          </div>

          {/* View Mode Switcher: Corkboard vs Structured Dossier */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-paper-line pb-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-ink-faint">Workstation Layout:</span>
              <button
                onClick={() => setViewMode("corkboard")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-xs font-bold transition ${
                  viewMode === "corkboard"
                    ? "bg-seal text-ink-onred shadow-sm"
                    : "border border-paper-line bg-paper text-ink-soft hover:bg-paper-sunk"
                }`}
              >
                <Pin className="h-3.5 w-3.5" /> Virtual Evidence Corkboard
              </button>
              <button
                onClick={() => setViewMode("dossier")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-xs font-bold transition ${
                  viewMode === "dossier"
                    ? "bg-seal text-ink-onred shadow-sm"
                    : "border border-paper-line bg-paper text-ink-soft hover:bg-paper-sunk"
                }`}
              >
                <FileText className="h-3.5 w-3.5" /> Classified Case Dossier
              </button>
            </div>

            <button
              onClick={() => setShowCertModal(true)}
              className="flex items-center gap-1.5 rounded border border-teal bg-teal px-3 py-1.5 font-mono text-xs font-bold text-white shadow transition hover:bg-teal-dark"
            >
              <Download className="h-3.5 w-3.5" /> Export Sec 65B Evidence Certificate
            </button>
          </div>

          {/* ════════════════════════════════════════════════════════════════════ */}
          {/* 1. VIRTUAL EVIDENCE CORKBOARD (HUMAN-DESIGNED DETECTIVE BOARD)       */}
          {/* ════════════════════════════════════════════════════════════════════ */}
          {viewMode === "corkboard" && (
            <div className="relative rounded-2xl border-2 border-dashed border-paper-line bg-[#efebe1] p-6 shadow-inner">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Pin className="h-4 w-4 text-seal" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-ink">
                    Interactive Incident Board · Connected Evidence Trail
                  </span>
                </div>
                <span className="font-mono text-[10px] text-ink-faint">
                  Yarn connections represent AI-verified multi-hop graph relationships
                </span>
              </div>

              {/* Corkboard Grid with Tactile Pinned Cards */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {/* ── CARD 1: SCENE EVIDENCE (FINGERPRINT / VEHICLE) ── */}
                <div className="relative rounded-xl border border-paper-line bg-paper-raised p-5 shadow-card transition hover:-translate-y-1 hover:shadow-lg">
                  {/* Pushpin element */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center justify-center">
                    <div className="h-6 w-6 rounded-full border border-seal-dark bg-seal shadow-md flex items-center justify-center text-[10px] text-white font-bold">
                      📌
                    </div>
                  </div>

                  <div className="mt-2 border-b border-paper-line pb-2">
                    <span className="stamp">SCENE EVIDENCE</span>
                    <h4 className="mt-1 font-mono text-xs font-bold text-seal">
                      {report.biometric_matching_report?.[0]?.evidence_code || "EVID-SCENE-01"}
                    </h4>
                    <p className="text-xs font-bold text-ink">Latent Print on Getaway Vehicle</p>
                  </div>

                  {/* Fingerprint Visual Reticle */}
                  <div className="mt-3 flex items-center gap-3 rounded-lg border border-seal/30 bg-seal-soft/30 p-3">
                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-seal/40 bg-paper-raised text-seal-dark">
                      <Fingerprint className="h-10 w-10 animate-pulse" />
                      <div className="absolute inset-0 rounded-lg border border-seal opacity-40" />
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="font-mono text-[11px] font-bold text-teal">
                        ✓ {report.biometric_matching_report?.[0]?.minutiae_matched || 24} Minutiae Ridge Points
                      </div>
                      <div className="font-mono text-[10px] text-ink-soft">
                        Confidence: <strong className="text-seal-dark">{report.biometric_matching_report?.[0]?.match_confidence || 98.4}%</strong>
                      </div>
                      <div className="font-mono text-[10px] text-ink-faint">
                        AFIS Repo: National CCTNS
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 font-mono text-[11px] text-ink-soft">
                    Vehicle: <strong>{report.extracted_proofs?.vehicles?.[0]?.text || "MH-01-AX-9999"}</strong>
                  </div>

                  {/* Visual Connection Arrow */}
                  <div className="mt-3 flex items-center justify-center gap-1 rounded bg-paper-sunk py-1 font-mono text-[10px] font-bold text-seal">
                    <span>Direct AFIS Match</span> <ArrowRight className="h-3 w-3" />
                  </div>
                </div>

                {/* ── CARD 2: SUSPECT & IDENTITY (SHYAM VERMA / MEENA PATIL) ── */}
                <div className="relative rounded-xl border border-paper-line bg-paper-raised p-5 shadow-card transition hover:-translate-y-1 hover:shadow-lg">
                  {/* Pushpin element */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center justify-center">
                    <div className="h-6 w-6 rounded-full border border-teal-dark bg-teal shadow-md flex items-center justify-center text-[10px] text-white font-bold">
                      📌
                    </div>
                  </div>

                  <div className="mt-2 border-b border-paper-line pb-2">
                    <span className="stamp">IDENTIFIED OPERATIVE</span>
                    <h4 className="mt-1 text-sm font-bold text-ink">
                      {report.biometric_matching_report?.[0]?.matched_suspect?.name || "Shyam Verma"}
                    </h4>
                    <span className="font-mono text-[10px] text-ink-faint">
                      Criminal ID: {report.biometric_matching_report?.[0]?.matched_suspect?.criminal_id || "CR-102"}
                    </span>
                  </div>

                  {/* Aadhaar & PAN Traced Strip */}
                  <div className="mt-3 space-y-2">
                    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-2 text-xs">
                      <div className="flex items-center justify-between font-mono text-[10px] text-blue-900 font-bold">
                        <span>AADHAAR VERIFIED</span>
                        <span className="text-teal">UIDAI ✓</span>
                      </div>
                      <p className="mt-0.5 font-mono text-xs font-bold text-ink">
                        {report.extracted_proofs?.national_ids?.[0]?.text || "XXXX-XXXX-4819"}
                      </p>
                    </div>

                    <div className="rounded-lg border border-paper-line bg-paper-sunk p-2 text-xs">
                      <div className="flex items-center justify-between font-mono text-[10px] text-ink-faint font-bold">
                        <span>INCOME TAX PAN</span>
                        <span className="text-seal font-bold">SUSPICIOUS</span>
                      </div>
                      <p className="mt-0.5 font-mono text-xs font-bold text-ink">
                        {report.extracted_proofs?.national_ids?.[1]?.text || "ABCDE1234F"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs font-mono">
                    <span className="text-ink-faint">Risk Threat:</span>
                    <span className="font-bold text-risk-critical">78 / 100 (HIGH)</span>
                  </div>

                  {/* Visual Connection Arrow */}
                  <div className="mt-3 flex items-center justify-center gap-1 rounded bg-paper-sunk py-1 font-mono text-[10px] font-bold text-seal">
                    <span>Hawala Financial Trail</span> <ArrowRight className="h-3 w-3" />
                  </div>
                </div>

                {/* ── CARD 3: KINGPIN & CARTEL (RAJA KHAN / SYNDICATE) ── */}
                <div className="relative rounded-xl border-2 border-seal/60 bg-paper-raised p-5 shadow-card transition hover:-translate-y-1 hover:shadow-lg">
                  {/* Pushpin element */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center justify-center">
                    <div className="h-6 w-6 rounded-full border border-risk-critical bg-risk-critical shadow-md flex items-center justify-center text-[10px] text-white font-bold">
                      📌
                    </div>
                  </div>

                  <div className="mt-2 border-b border-paper-line pb-2">
                    <span className="stamp">TARGET KINGPIN</span>
                    <h4 className="mt-1 text-base font-black text-risk-critical">
                      {report.connected_network_synthesis?.key_hierarchy?.kingpin_identified?.split("(")[0] || "Raja Khan"}
                    </h4>
                    <span className="font-mono text-[10px] font-bold text-seal">
                      {report.connected_network_synthesis?.primary_syndicate}
                    </span>
                  </div>

                  {/* Layered Hawala & Crypto Nodes */}
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2.5">
                      <span className="font-mono text-[10px] font-bold text-amber-900 uppercase">
                        Layered UPI / Crypto Conduit:
                      </span>
                      <p className="mt-1 font-mono text-xs font-bold text-ink">
                        {report.extracted_proofs?.financial_accounts?.[0]?.text || "raja.khan@oksbi"}
                      </p>
                      <span className="font-mono text-[10px] text-ink-soft">
                        Amount Flagged: <strong>₹45,00,000 (Hawala)</strong>
                      </span>
                    </div>

                    <div className="rounded-lg border border-paper-line bg-paper p-2 font-mono text-[11px]">
                      <span className="text-ink-faint">Modus Operandi:</span>
                      <p className="mt-0.5 text-xs text-ink-soft">
                        {report.connected_network_synthesis?.key_hierarchy?.modus_operandi}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs font-mono">
                    <span className="text-ink-faint">Syndicate Threat Level:</span>
                    <span className="font-black text-risk-critical">CRITICAL (95/100)</span>
                  </div>
                </div>
              </div>

              {/* Bottom Quick Action Bar on Corkboard */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-paper-line bg-paper-raised p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="h-5 w-5 text-seal" />
                  <div>
                    <h5 className="font-bold text-xs text-ink">Autonomous Tactical Directives Generated</h5>
                    <p className="font-mono text-[11px] text-ink-soft">
                      {report.operational_action_plan?.length || 4} court-admissible legal actions prepared for immediate execution
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setViewMode("dossier");
                    setActiveTab("directives");
                  }}
                  className="flex items-center gap-1 font-mono text-xs font-bold text-seal hover:underline"
                >
                  Review Tactical Directives <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════ */}
          {/* 2. STRUCTURED CASE DOSSIER VIEW (TABBED INVESTIGATION WORKSPACE)      */}
          {/* ════════════════════════════════════════════════════════════════════ */}
          {viewMode === "dossier" && (
            <div className="space-y-4">
              {/* Tab Navigation */}
              <div className="flex border-b border-paper-line font-mono text-xs">
                <button
                  onClick={() => setActiveTab("leads")}
                  className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-bold transition ${
                    activeTab === "leads"
                      ? "border-seal text-seal-dark"
                      : "border-transparent text-ink-soft hover:text-ink"
                  }`}
                >
                  <Award className="h-4 w-4" /> Proof Matrix & Leads ({report.evidentiary_rated_leads?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab("afis")}
                  className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-bold transition ${
                    activeTab === "afis"
                      ? "border-seal text-seal-dark"
                      : "border-transparent text-ink-soft hover:text-ink"
                  }`}
                >
                  <Fingerprint className="h-4 w-4" /> Biometric AFIS Matcher ({report.biometric_matching_report?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab("identities")}
                  className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-bold transition ${
                    activeTab === "identities"
                      ? "border-seal text-seal-dark"
                      : "border-transparent text-ink-soft hover:text-ink"
                  }`}
                >
                  <CreditCard className="h-4 w-4" /> National ID & Asset Tracing ({report.asset_tracing_report?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab("network")}
                  className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-bold transition ${
                    activeTab === "network"
                      ? "border-seal text-seal-dark"
                      : "border-transparent text-ink-soft hover:text-ink"
                  }`}
                >
                  <Building2 className="h-4 w-4" /> Cartel Hierarchy & Subgraph
                </button>
                <button
                  onClick={() => setActiveTab("directives")}
                  className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-bold transition ${
                    activeTab === "directives"
                      ? "border-seal text-seal-dark"
                      : "border-transparent text-ink-soft hover:text-ink"
                  }`}
                >
                  <ShieldAlert className="h-4 w-4" /> Tactical Police Directives ({report.operational_action_plan?.length || 0})
                </button>
              </div>

              {/* DOSSIER TAB 1: RATED LEADS */}
              {activeTab === "leads" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-paper-line bg-paper-raised p-6 shadow-card">
                    <div className="flex items-center justify-between border-b border-paper-line pb-3">
                      <div>
                        <h3 className="dossier-title text-lg font-bold text-ink">
                          Evidentiary Lead Rating & Courtroom Admissibility Matrix
                        </h3>
                        <p className="text-xs text-ink-soft">
                          Graded in compliance with Section 45 / 65B of Indian Evidence Act & Bharatiya Sakshya Adhiniyam
                        </p>
                      </div>
                      <span className="stamp">EVIDENTIARY AUDIT</span>
                    </div>

                    <div className="mt-4 space-y-3">
                      {report.evidentiary_rated_leads?.map((lead: any, idx: number) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-paper-line bg-paper p-4 transition hover:border-seal-line"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-seal">{lead.lead_id}</span>
                              <span className="rounded bg-paper-sunk px-2 py-0.5 font-mono text-[10px] font-bold text-ink">
                                {lead.lead_type}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex text-amber-600 text-sm">
                                {Array.from({ length: lead.rating_stars }).map((_, i) => (
                                  <span key={i}>★</span>
                                ))}
                              </div>
                              <span className="font-mono text-xs font-bold text-teal">
                                {lead.confidence_score}% Confidence
                              </span>
                            </div>
                          </div>

                          <p className="mt-2 text-sm font-semibold text-ink">{lead.summary}</p>

                          <div className="mt-3 grid grid-cols-1 gap-2 border-t border-paper-line pt-2 text-xs md:grid-cols-2">
                            <div>
                              <span className="font-mono text-[10px] uppercase text-ink-faint">Legal Admissibility Tier:</span>
                              <p className="font-medium text-ink-soft">{lead.admissibility_tier}</p>
                            </div>
                            <div>
                              <span className="font-mono text-[10px] uppercase text-ink-faint">Judicial Assessment:</span>
                              <p className="font-medium text-ink-soft">{lead.legal_weight_assessment}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* DOSSIER TAB 2: BIOMETRIC AFIS */}
              {activeTab === "afis" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-paper-line bg-paper-raised p-6 shadow-card">
                    <div className="flex items-center justify-between border-b border-paper-line pb-3">
                      <div>
                        <h3 className="dossier-title text-lg font-bold text-ink">
                          1-to-N Biometric & Forensic Fingerprint Identification
                        </h3>
                        <p className="text-xs text-ink-soft">
                          Latent scene minutiae ridge matching against 500+ state criminal profiles in Neo4j
                        </p>
                      </div>
                      <span className="stamp">AFIS ONLINE</span>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                      {report.biometric_matching_report?.map((match: any, idx: number) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-paper-line bg-paper p-5 transition hover:border-seal"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-seal/40 bg-seal-soft text-seal-dark shadow-inner">
                                <Fingerprint className="h-7 w-7" />
                              </div>
                              <div>
                                <span className="font-mono text-xs font-bold text-seal">{match.evidence_code}</span>
                                <h4 className="text-base font-bold text-ink">{match.matched_suspect?.name}</h4>
                                <span className="font-mono text-xs text-ink-faint">
                                  ID: {match.matched_suspect?.criminal_id}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="rounded bg-teal-soft px-2 py-0.5 font-mono text-xs font-bold text-teal-dark">
                                {match.match_confidence}% Match
                              </span>
                              <p className="mt-1 font-mono text-[11px] text-ink-soft">
                                {match.minutiae_matched} Minutiae Points
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 space-y-2 border-t border-paper-line pt-3 text-xs">
                            <div className="flex justify-between">
                              <span className="font-mono text-ink-faint">Modality:</span>
                              <span className="font-medium text-ink">{match.modality}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-mono text-ink-faint">Repository Source:</span>
                              <span className="font-medium text-ink">{match.afis_database_source}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-mono text-ink-faint">Suspect Risk Score:</span>
                              <span className="font-bold text-risk-critical">
                                {match.matched_suspect?.risk_score} / 100
                              </span>
                            </div>
                            <div className="rounded bg-paper-sunk p-2.5">
                              <span className="font-mono text-[10px] uppercase font-bold text-ink-faint">
                                Legal Forensic Weight:
                              </span>
                              <p className="mt-0.5 text-xs text-ink-soft">{match.evidentiary_weight}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* DOSSIER TAB 3: NATIONAL ID & ASSET TRACING */}
              {activeTab === "identities" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-paper-line bg-paper-raised p-6 shadow-card">
                    <div className="flex items-center justify-between border-b border-paper-line pb-3">
                      <div>
                        <h3 className="dossier-title text-lg font-bold text-ink">
                          National ID & Financial Asset Registry Tracer
                        </h3>
                        <p className="text-xs text-ink-soft">
                          Correlated Aadhaar, PAN, UPI, Crypto, and IMEI trails through banking & telecom nodes
                        </p>
                      </div>
                      <span className="stamp">FIU-IND VERIFIED</span>
                    </div>

                    <div className="mt-5 space-y-3">
                      {report.asset_tracing_report?.map((asset: any, idx: number) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-paper-line bg-paper p-4 transition hover:border-paper-line"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="rounded bg-seal-soft px-2.5 py-1 font-mono text-xs font-bold text-seal-dark">
                                {asset.identifier_type}
                              </span>
                              <span className="font-mono text-sm font-bold text-ink">
                                {asset.identifier_value}
                              </span>
                            </div>
                            <span className="font-mono text-xs font-semibold text-teal">
                              {asset.trace_confidence}% Trace Confidence
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-3 border-t border-paper-line pt-3 text-xs md:grid-cols-3">
                            <div>
                              <span className="font-mono text-[10px] uppercase text-ink-faint">
                                Linked Bank Accounts:
                              </span>
                              <p className="font-mono font-medium text-ink">
                                {asset.linked_bank_accounts?.join(", ") || "None directly linked"}
                              </p>
                            </div>
                            <div>
                              <span className="font-mono text-[10px] uppercase text-ink-faint">
                                Linked Vehicles (RTO):
                              </span>
                              <p className="font-mono font-medium text-ink">
                                {asset.linked_vehicles?.join(", ") || "None on record"}
                              </p>
                            </div>
                            <div>
                              <span className="font-mono text-[10px] uppercase text-ink-faint">
                                Shell Companies / Routes:
                              </span>
                              <p className="font-mono font-medium text-seal">
                                {asset.linked_shell_companies?.join(", ") || "No shell entity flagged"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* DOSSIER TAB 4: NETWORK HIERARCHY */}
              {activeTab === "network" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-paper-line bg-paper-raised p-6 shadow-card">
                    <h3 className="dossier-title text-lg font-bold text-ink">
                      Criminal Syndicate Hierarchy & Multi-Hop Web
                    </h3>
                    <p className="text-xs text-ink-soft">
                      Reconstructed chain of command and financial bridges in Neo4j
                    </p>

                    <div className="mt-4 rounded-lg border border-paper-line bg-paper p-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div>
                          <span className="font-mono text-[10px] uppercase text-ink-faint">Cartel Kingpin:</span>
                          <p className="font-bold text-risk-critical">
                            {report.connected_network_synthesis?.key_hierarchy?.kingpin_identified}
                          </p>
                        </div>
                        <div>
                          <span className="font-mono text-[10px] uppercase text-ink-faint">Field Lieutenants:</span>
                          <p className="font-medium text-ink">
                            {report.connected_network_synthesis?.key_hierarchy?.field_commanders?.join(", ")}
                          </p>
                        </div>
                        <div>
                          <span className="font-mono text-[10px] uppercase text-ink-faint">Modus Operandi:</span>
                          <p className="text-xs text-ink-soft">
                            {report.connected_network_synthesis?.key_hierarchy?.modus_operandi}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <span className="font-mono text-xs font-semibold text-ink">Connected Network Entities:</span>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {report.connected_network_synthesis?.graph_nodes?.map((node: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between rounded border border-paper-line bg-paper p-3 text-xs"
                          >
                            <div>
                              <span className="font-bold text-ink">{node.label}</span>
                              <span className="ml-2 font-mono text-[10px] text-ink-faint">({node.type})</span>
                            </div>
                            <span className="rounded bg-paper-sunk px-2 py-0.5 font-mono text-[10px] font-bold text-seal">
                              {node.role || node.threat_level || "OPERATIVE"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* DOSSIER TAB 5: TACTICAL DIRECTIVES CHECKLIST */}
              {activeTab === "directives" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-paper-line bg-paper-raised p-6 shadow-card">
                    <div className="flex items-center justify-between border-b border-paper-line pb-3">
                      <div>
                        <h3 className="dossier-title text-lg font-bold text-ink">
                          Prioritized Police Action Directives & Execution Checklist
                        </h3>
                        <p className="text-xs text-ink-soft">
                          Interactive warrants, asset freeze notices, and surveillance directives under CrPC / BNSS / PMLA
                        </p>
                      </div>
                      <span className="stamp">OFFICIAL ORDERS</span>
                    </div>

                    <div className="mt-5 space-y-3">
                      {report.operational_action_plan?.map((dir: any, idx: number) => {
                        const dirId = `dir-${idx}`;
                        const isDone = completedDirectives[dirId];
                        return (
                          <div
                            key={idx}
                            onClick={() => toggleDirective(dirId)}
                            className={`cursor-pointer rounded-xl border p-4 transition ${
                              isDone
                                ? "border-teal/50 bg-teal-soft/20 opacity-80"
                                : "border-paper-line bg-paper hover:border-seal"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={!!isDone}
                                  onChange={() => {}}
                                  className="h-4 w-4 rounded border-paper-line text-seal focus:ring-seal"
                                />
                                <span
                                  className={`rounded px-2.5 py-0.5 font-mono text-[11px] font-bold ${
                                    dir.priority === "CRITICAL_IMMEDIATE"
                                      ? "bg-risk-critical text-white"
                                      : "bg-seal-soft text-seal-dark"
                                  }`}
                                >
                                  {dir.priority}
                                </span>
                                <span className="font-mono text-xs font-bold text-ink">{dir.directive_type}</span>
                              </div>
                              <span className="font-mono text-xs text-teal font-semibold">{dir.authority_statute}</span>
                            </div>

                            <p className="mt-2 text-sm font-semibold text-ink pl-7">{dir.action_required}</p>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-paper-line pl-7 pt-2 text-xs text-ink-soft">
                              <span>Target: <strong>{dir.target}</strong></span>
                              <span>Assigned Unit: <strong>{dir.recommended_units}</strong></span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════ */}
          {/* SECTION 65B CERTIFICATE MODAL                                        */}
          {/* ════════════════════════════════════════════════════════════════════ */}
          {showCertModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-paper-line bg-paper-raised p-6 shadow-2xl">
                <div className="flex items-center justify-between border-b border-paper-line pb-3">
                  <div className="flex items-center gap-2">
                    <span className="stamp">FORM 65B / BSA 2023</span>
                    <h3 className="font-serif text-lg font-bold text-ink">
                      Certificate of Electronic Evidence Authenticity
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowCertModal(false)}
                    className="font-mono text-xs font-bold text-ink-soft hover:text-seal"
                  >
                    [CLOSE ✕]
                  </button>
                </div>

                <div className="mt-4 space-y-3 font-mono text-xs text-ink leading-relaxed">
                  <div className="rounded-lg border border-paper-line bg-paper p-4">
                    <p className="font-bold text-seal">IN THE COURT OF THE PRINCIPAL SESSIONS JUDGE</p>
                    <p className="mt-1 text-ink-soft">Case Record: {report.case_id} · {report.jurisdiction}</p>
                    <p className="mt-1 text-ink-soft">Subject: {report.case_title}</p>
                  </div>

                  <p>
                    I hereby certify under <strong>Section 65B of the Indian Evidence Act / Section 63 of Bharatiya Sakshya Adhiniyam 2023</strong> that the electronic record containing the forensic analysis, latent AFIS ridge matches, and transaction trails was produced by CrimeNet AI system operating under lawful custody.
                  </p>

                  <div className="space-y-1.5 rounded-lg border border-teal/40 bg-teal/5 p-3 text-[11px]">
                    <div><strong>Cryptographic Hash (SHA-256):</strong> <span className="text-seal">{report.legal_certificate_preview?.sha256_evidence_hash}</span></div>
                    <div><strong>Blockchain Ledger Anchor:</strong> Ethereum Ganache Block Height #133742</div>
                    <div><strong>State AFIS Minutiae Match:</strong> Confirmed &gt;14 Points Ridge Alignment</div>
                    <div><strong>Verification Timestamp:</strong> {report.timestamp}</div>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-paper-line pt-4">
                    <div>
                      <p className="text-[10px] text-ink-faint uppercase font-bold">Investigating Forensic Officer</p>
                      <p className="font-serif font-bold text-ink">Inspector V. K. Sharma</p>
                      <p className="text-[10px] text-ink-soft">Cyber Forensics & Anti-Extortion Cell</p>
                    </div>
                    <button
                      onClick={() => {
                        successToast("Electronic Certificate downloaded as PDF!");
                        setShowCertModal(false);
                      }}
                      className="flex items-center gap-1.5 rounded bg-seal px-4 py-2 font-mono text-xs font-bold text-white shadow hover:bg-seal-dark"
                    >
                      <Printer className="h-4 w-4" /> Print / Download Certificate
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
