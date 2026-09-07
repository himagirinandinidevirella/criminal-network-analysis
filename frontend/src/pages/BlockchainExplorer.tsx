/**
 * Blockchain Explorer page — evidence integrity, immutable audit trail,
 * record history, report certificates, agency sharing and cyber-crime
 * detection in one place.
 */
import { Link2, ScanLine, Zap } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/Common/Tabs";
import BlockchainStatusCard from "@/components/Blockchain/BlockchainStatusCard";
import TamperDetectionDemo from "@/components/Blockchain/TamperDetectionDemo";
import EvidenceChainPanel from "@/components/Blockchain/EvidenceChainPanel";
import EvidenceVerifier from "@/components/Blockchain/EvidenceVerifier";
import AuditTrailViewer from "@/components/Blockchain/AuditTrailViewer";
import RecordHistoryTimeline from "@/components/Blockchain/RecordHistoryTimeline";
import ReportCertificateCard from "@/components/Blockchain/ReportCertificateCard";
import AgencyShareManager from "@/components/Blockchain/AgencyShareManager";
import CyberThreatScanner from "@/components/CyberCrime/CyberThreatScanner";
import CyberRiskPanel from "@/components/CyberCrime/CyberRiskPanel";

export default function BlockchainExplorer() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass rounded-2xl p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-cyan/15 text-accent-cyan">
            <Link2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Blockchain Explorer</h1>
            <p className="text-xs text-text-muted">
              Tamper-proof evidence · immutable audit trail · inter-agency sharing
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 rounded-lg border border-accent-cyan/30 bg-accent-cyan/10 px-3 py-1.5 text-xs text-accent-cyan">
            <ScanLine className="h-4 w-4" /> Chain-secured operations
          </div>
        </div>
      </div>

      <BlockchainStatusCard />

      <Tabs defaultValue="demo">
        <TabsList className="flex-wrap">
          <TabsTrigger value="demo" className="flex items-center gap-1"><Zap className="h-3.5 w-3.5" />Live Demo</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="verify">Tamper Check</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          <TabsTrigger value="records">Records</TabsTrigger>
          <TabsTrigger value="reports">Certificates</TabsTrigger>
          <TabsTrigger value="sharing">Agency Sharing</TabsTrigger>
          <TabsTrigger value="cyber">Cyber Threats</TabsTrigger>
        </TabsList>

        <TabsContent value="demo">
          <TamperDetectionDemo />
        </TabsContent>

        <TabsContent value="evidence">
          <EvidenceChainPanel />
        </TabsContent>

        <TabsContent value="verify">
          <EvidenceVerifier />
        </TabsContent>

        <TabsContent value="audit">
          <AuditTrailViewer />
        </TabsContent>

        <TabsContent value="records">
          <RecordHistoryTimeline />
        </TabsContent>

        <TabsContent value="reports">
          <ReportCertificateCard />
        </TabsContent>

        <TabsContent value="sharing">
          <AgencyShareManager />
        </TabsContent>

        <TabsContent value="cyber">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <CyberThreatScanner />
            <CyberRiskPanel />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
