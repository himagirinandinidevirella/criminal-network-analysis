/**
 * TopNavbar — global search, classification stamp, alert bell, profile.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Search, Bell, UserCircle } from "lucide-react";
import { RootState } from "@/store";

export default function TopNavbar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const user = useSelector((state: RootState) => state.auth.user);
  const alertCount = useSelector((state: RootState) => state.alerts.active.length);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/investigation?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <header className="flex h-16 items-center gap-4 border-b border-paper-line bg-paper-raised px-6">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="relative max-w-xl flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search criminals, vehicles, accounts, locations…"
          className="w-full rounded-md border border-paper-line bg-paper-sunk py-2 pl-9 pr-3 font-mono text-sm text-ink placeholder-ink-faint transition focus:border-seal focus:outline-none focus:ring-1 focus:ring-seal"
          aria-label="Global search"
        />
      </form>

      <div className="ml-auto flex items-center gap-3">
        {/* Classification stamp */}
        <span className="stamp hidden md:inline-block">Restricted</span>

        {/* Alerts bell */}
        <button
          onClick={() => navigate("/alerts")}
          className="relative rounded-md border border-paper-line p-2 text-ink-soft transition hover:bg-paper-sunk"
          aria-label={`Alerts (${alertCount} active)`}
        >
          <Bell className="h-5 w-5" />
          {alertCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-risk-critical px-1 text-[9px] font-bold text-white">
              {alertCount > 99 ? "99+" : alertCount}
            </span>
          )}
        </button>

        {/* Profile */}
        <button
          onClick={() => navigate("/settings")}
          className="flex items-center gap-2 rounded-md border border-paper-line px-3 py-1.5 text-sm transition hover:bg-paper-sunk"
          aria-label="Profile"
        >
          <UserCircle className="h-6 w-6 text-ink-faint" />
          <span className="hidden font-medium sm:inline">{user?.name ?? "Officer"}</span>
        </button>
      </div>
    </header>
  );
}
