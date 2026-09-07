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
  // Connect to the real-time alert stream for the whole app.
  useWebSocket();

  return (
    <div className="flex h-screen overflow-hidden bg-paper paper-grain">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNavbar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
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
