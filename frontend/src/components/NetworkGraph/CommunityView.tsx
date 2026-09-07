/**
 * CommunityView — list detected gangs/networks (Louvain communities).
 */
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Users } from "lucide-react";
import { AppDispatch, RootState } from "@/store";
import { fetchCommunities } from "@/store/networkSlice";
import LoadingSkeleton from "@/components/Common/LoadingSkeleton";

export default function CommunityView() {
  const dispatch = useDispatch<AppDispatch>();
  const communities = useSelector((state: RootState) => state.network.communities);
  const loading = useSelector((state: RootState) => state.network.loading);

  useEffect(() => {
    if (communities.length === 0) dispatch(fetchCommunities());
  }, [dispatch, communities.length]);

  return (
    <div className="glass rounded-2xl p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Users className="h-4 w-4 text-accent-blue" /> Detected Networks
      </h3>
      {loading && communities.length === 0 ? (
        <LoadingSkeleton lines={4} />
      ) : (
        <ul className="space-y-2">
          {communities.slice(0, 8).map((c) => (
            <li key={c.id} className="rounded-lg bg-bg-tertiary p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">{c.name}</span>
                <span className="text-[10px] text-text-muted">{c.size} members</span>
              </div>
              {c.crime_types.length > 0 && (
                <p className="mt-1 text-[10px] text-text-secondary">
                  {c.crime_types.join(" · ")}
                </p>
              )}
            </li>
          ))}
          {communities.length === 0 && !loading && (
            <p className="py-4 text-center text-xs text-text-muted">No communities detected</p>
          )}
        </ul>
      )}
    </div>
  );
}
