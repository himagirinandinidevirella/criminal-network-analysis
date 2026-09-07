/**
 * App — route table.
 */
import { Routes, Route, Navigate } from "react-router-dom";
import DemoProvider from "@/components/Demo/DemoProvider";
import ProtectedRoute from "@/components/Auth/ProtectedRoute";
import MainLayout from "@/components/Layout/MainLayout";
import Login from "@/components/Auth/Login";
import PublicReport from "@/components/Auth/PublicReport";
import Dashboard from "@/pages/Dashboard";
import Overview from "@/pages/Overview";
import NetworkAnalysis from "@/pages/NetworkAnalysis";
import Investigation from "@/pages/Investigation";
import CriminalProfile from "@/pages/CriminalProfile";
import Alerts from "@/pages/Alerts";
import Reports from "@/pages/Reports";
import CrimeMap from "@/pages/CrimeMap";
import AIAssistant from "@/pages/AIAssistant";
import Settings from "@/pages/Settings";
import PublicView from "@/pages/PublicView";
import BlockchainExplorer from "@/pages/BlockchainExplorer";

export default function App() {
  return (
    <DemoProvider>
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
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </DemoProvider>
  );
}
