/**
 * RiskDistributionChart — donut chart of criminal risk levels.
 */
import { useSelector } from "react-redux";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { RootState } from "@/store";

const COLORS = ["#B3261E", "#C0551F", "#9A6A12", "#1E7A55"];

export default function RiskDistributionChart() {
  const statistics = useSelector((state: RootState) => state.network.statistics);
  const dist = statistics?.risk_distribution;

  const data = dist
    ? [
        { name: "Critical", value: dist.critical ?? 0 },
        { name: "High", value: dist.high ?? 0 },
        { name: "Medium", value: dist.medium ?? 0 },
        { name: "Low", value: dist.low ?? 0 },
      ]
    : [];

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="glass rounded-2xl p-4">
      <h2 className="mb-3 text-sm font-semibold">Risk Distribution</h2>
      {total === 0 ? (
        <p className="py-8 text-center text-xs text-text-muted">No risk data available</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: "#FCFAF5", border: "1px solid #DDD5C2", borderRadius: 8 }}
              itemStyle={{ color: "#1B2530" }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "#4E5863" }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
