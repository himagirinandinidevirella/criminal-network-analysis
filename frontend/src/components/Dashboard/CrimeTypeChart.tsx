/**
 * CrimeTypeChart — bar chart of crime types across the network.
 */
import { useSelector } from "react-redux";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { RootState } from "@/store";
import { BarChart3 } from "lucide-react";

export default function CrimeTypeChart() {
  const statistics = useSelector((state: RootState) => state.network.statistics);
  const data = (statistics?.crime_types ?? []).map((c) => ({
    name: c.type.length > 14 ? c.type.slice(0, 14) + "…" : c.type,
    count: c.count,
  }));

  return (
    <div className="glass rounded-2xl p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <BarChart3 className="h-4 w-4 text-accent-blue" /> Crime Trends by Type
      </h2>
      {data.length === 0 ? (
        <p className="py-8 text-center text-xs text-text-muted">No crime data available</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#DDD5C2" />
            <XAxis dataKey="name" tick={{ fill: "#8A8F8B", fontSize: 10 }} />
            <YAxis tick={{ fill: "#8A8F8B", fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: "#FCFAF5", border: "1px solid #DDD5C2", borderRadius: 8 }}
              labelStyle={{ color: "#1B2530" }}
            />
            <Bar dataKey="count" fill="#C13B26" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
