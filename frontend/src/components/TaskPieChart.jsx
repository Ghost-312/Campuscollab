import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = {
  Completed: "#00ff85",
  "In-Progress": "#00f5ff",
  "To-Do": "#ffd300"
};

const buildData = tasks => {
  const counts = {
    Completed: 0,
    "In-Progress": 0,
    "To-Do": 0
  };

  tasks.forEach(t => {
    if (counts[t.status] !== undefined) counts[t.status] += 1;
  });

  const total = tasks.length || 1;
  return Object.keys(counts).map(key => ({
    name: key,
    value: counts[key],
    percent: Math.round((counts[key] / total) * 100)
  }));
};

const formatPercent = value => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  const pct = value <= 1 ? value * 100 : value;
  return Math.min(100, Math.max(0, Math.round(pct)));
};

export default function TaskPieChart({ tasks }) {
  const data = buildData(tasks);
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="task-chart">
      <div className="task-chart-canvas">
        <ResponsiveContainer>
          <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={56}
              outerRadius={86}
              paddingAngle={1}
              labelLine={false}
              label={false}
            >
              {data.map(entry => (
                <Cell key={entry.name} fill={COLORS[entry.name]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v, n, p) => [
                `${v} (${formatPercent(p?.payload?.percent)}%)`,
                n
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="task-chart-center">
          <div className="task-chart-total">{total}</div>
          <div className="task-chart-label">Tasks</div>
        </div>
      </div>
      <div className="task-chart-summary">
        {data.map(item => (
          <div key={item.name} className="task-chart-item">
            <span
              className="task-chart-dot"
              style={{ background: COLORS[item.name] }}
            />
            <span>
              {item.name}: {item.value === 0 ? 0 : item.percent}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
