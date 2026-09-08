import { lazy, Suspense } from "react";
/**
 * App — route table.
 */
import { Routes, Route, Navigate } from "react-router-dom";
import DemoProvider from "@/components/Demo/DemoProvider";
import ProtectedRoute from "@/components/Auth/ProtectedRoute";
import MainLayout from "@/components/Layout/MainLayout";
import Login from "@/components/Auth/Login";
import PublicReport from "@/components/Auth/PublicReport";
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Overview = lazy(() => import("@/pages/Overview"));
const NetworkAnalysis = lazy(() => import("@/pages/NetworkAnalysis"));
const Investigation = lazy(() => import("@/pages/Investigation"));
const CriminalProfile = lazy(() => import("@/pages/CriminalProfile"));
const Alerts = lazy(() => import("@/pages/Alerts"));
const Reports = lazy(() => import("@/pages/Reports"));
const CrimeMap = lazy(() => import("@/pages/CrimeMap"));
const AIAssistant = lazy(() => import("@/pages/AIAssistant"));
const Settings = lazy(() => import("@/pages/Settings"));
const FingerprintVerification = lazy(
  () => import("@/pages/FingerprintVerification"),
);
const PublicView = lazy(() => import("@/pages/PublicView"));
const BlockchainExplorer = lazy(() => import("@/pages/BlockchainExplorer"));

export default function App() {
  return (
    <DemoProvider>
      <Suspense
        fallback={
          <div className="p-8 text-sm text-ink-soft" role="status">
            Loading workspace…
          </div>
        }
      >
        <Routes>
          {/* Public (no auth) */}
          <Route path="/login" element={<Login />} />
          <Route path="/public/report/:token" element={<PublicReport />} />
          <Route path="/public" element={<PublicView />} />

          {/* Authenticated app */}
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/overview" element={<Overview />} />
            <Route path="/network" element={<NetworkAnalysis />} />
            <Route path="/investigation" element={<Investigation />} />
            <Route path="/criminal/:id" element={<CriminalProfile />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/map" element={<CrimeMap />} />
            <Route path="/chat" element={<AIAssistant />} />
            <Route path="/blockchain" element={<BlockchainExplorer />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/fingerprints" element={<FingerprintVerification />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </DemoProvider>
  );
}
