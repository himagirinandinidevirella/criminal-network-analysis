/**
 * SavedSearches — list of the user's saved searches.
 */
import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import { get } from "@/services/api";

interface SavedSearch {
  id: number;
  query: string;
  name: string;
  created_at: string;
}

export default function SavedSearches() {
  const [searches, setSearches] = useState<SavedSearch[]>([]);

  useEffect(() => {
    get<SavedSearch[]>("/api/search/saved")
      .then(setSearches)
      .catch(() => setSearches([]));
  }, []);

  return (
    <div className="glass rounded-2xl p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Bookmark className="h-4 w-4 text-accent-cyan" /> Saved Searches
      </h3>
      {searches.length === 0 ? (
        <p className="py-2 text-xs text-text-muted">No saved searches yet.</p>
      ) : (
        <ul className="space-y-2">
          {searches.map((s) => (
            <li key={s.id} className="rounded-lg bg-bg-tertiary px-3 py-2 text-xs">
              <p className="font-medium">{s.name}</p>
              <p className="truncate text-text-muted">{s.query}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
