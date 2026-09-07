/**
 * Sidebar — primary navigation.
 * "Classified dossier" styling: paper, serif brand, vermilion active rule.
 */
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  LayoutDashboard, Network, Search, Bell, FileBarChart, Map as MapIcon,
  Bot, Settings, LogOut, ChevronLeft, ChevronRight, Shield, Link2, BookOpen,
} from "lucide-react";
import { RootState } from "@/store";
import { logout } from "@/store/authSlice";

const NAV_SECTIONS: Array<{ label: string; items: Array<{ to: string; label: string; icon: typeof LayoutDashboard; end?: boolean }> }> = [
  {
    label: "Operations",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/investigation", label: "Investigation", icon: Search },
      { to: "/alerts", label: "Alerts", icon: Bell },
      { to: "/map", label: "Crime Map", icon: MapIcon },
    ],
  },
  {
    label: "Analysis",
    items: [
      { to: "/network", label: "Network Analysis", icon: Network },
      { to: "/blockchain", label: "Blockchain", icon: Link2 },
      { to: "/chat", label: "AI Assistant", icon: Bot },
    ],
  },
  {
    label: "Output",
    items: [{ to: "/reports", label: "Reports", icon: FileBarChart }],
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const alertCount = useSelector((state: RootState) => state.alerts.active.length);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  return (
    <aside
      className={`flex h-full flex-col border-r border-paper-line bg-paper-raised transition-all duration-200 ${
        collapsed ? "w-[68px]" : "w-64"
      }`}
      aria-label="Primary navigation"
    >
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-paper-line px-4 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-seal text-paper-raised shadow-card">
          <Shield className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <div className="dossier-title text-lg font-bold tracking-tight">
              CrimeNet
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
              Ministry of Home Affairs
            </div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {/* Project overview — evaluator entry point */}
        <div>
          <NavLink
            to="/overview"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? "border-seal-line bg-seal-soft text-seal"
                  : "border-paper-line text-ink hover:border-seal-line hover:bg-paper-sunk"
              }`
            }
            title={collapsed ? "Project overview" : undefined}
          >
            <BookOpen className="h-5 w-5 shrink-0" />
            {!collapsed && (
              <span className="leading-tight">
                Project Overview
                <span className="block text-[10px] font-normal uppercase tracking-wide text-ink-faint">
                  How it works
                </span>
              </span>
            )}
          </NavLink>
        </div>

        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <div className="mb-1.5 px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                {section.label}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? "bg-seal-soft text-seal"
                        : "text-ink-soft hover:bg-paper-sunk hover:text-ink"
                    }`
                  }
                  title={collapsed ? label : undefined}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-seal" />
                      )}
                      <span className="relative">
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        {to === "/alerts" && alertCount > 0 && (
                          <span className="absolute -right-2.5 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-risk-critical px-1 text-[9px] font-bold text-white">
                            {alertCount > 99 ? "99+" : alertCount}
                          </span>
                        )}
                      </span>
                      {!collapsed && <span>{label}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-paper-line p-3">
        {!collapsed ? (
          <div className="mb-2 rounded-md border border-paper-line bg-paper-sunk px-3 py-2.5">
            <div className="truncate font-mono text-sm font-semibold">{user?.name ?? "Officer"}</div>
            <div className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">
              {user?.role ?? "—"}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[10px] text-risk-low">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-risk-low" /> ONLINE
            </div>
          </div>
        ) : (
          <div className="mb-2 flex justify-center">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-risk-low" title="Online" />
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={handleLogout}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-paper-line px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-seal-soft hover:text-seal"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && "Logout"}
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="rounded-md border border-paper-line p-2 text-ink-soft transition hover:bg-paper-sunk"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
