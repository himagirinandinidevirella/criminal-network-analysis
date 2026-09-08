import { useDemo } from "@/hooks/useDemoMode";
import { useRealTimeAlerts } from "@/hooks/useRealTimeAlerts";
import { useState } from "react";
import { IS_DEMO } from "@/config/runtime";
import DemoNotice from "@/components/Demo/DemoNotice";
/**
 * MainLayout — the authenticated shell: sidebar + navbar + content + footer.
 */
import { Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import Sidebar from "./Sidebar";
import TopNavbar from "./TopNavbar";
import Footer from "./Footer";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function MainLayout() {
  const location = useLocation();
  const { active: tourActive } = useDemo();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Connect to the real-time alert stream for the whole app.
  useWebSocket();
  useRealTimeAlerts();

  return (
    <div className="flex h-screen overflow-hidden bg-paper paper-grain">
      {mobileOpen && (
        <button
          className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopNavbar onMenu={() => setMobileOpen(true)} />
        {IS_DEMO && <DemoNotice />}
        <main
          className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8"
          style={tourActive ? { paddingBottom: 280 } : undefined}
        >
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Outlet />
          </motion.div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
