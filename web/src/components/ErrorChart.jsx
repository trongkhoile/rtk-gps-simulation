import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from "recharts";

export default function ErrorChart({ data, stepIdx }) {
  return (
    <div>
      <h4 style={{ margin: "0 0 8px" }}>Sai so vi tri theo thoi gian (so voi quy dao that)</h4>
      <ResponsiveContainer width="100%" height={560}>
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="seq" label={{ value: "seq (thoi diem)", position: "insideBottom", offset: -5 }} />
          <YAxis label={{ value: "Sai so (m)", angle: -90, position: "insideLeft" }} />
          <Tooltip formatter={(v) => v.toFixed(3) + " m"} />
          <Legend verticalAlign="bottom" height={36} />
          <ReferenceLine x={stepIdx} stroke="gray" strokeDasharray="4 4" />
          <Line type="monotone" dataKey="error_raw_m" name="Sai so raw" stroke="red" dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="error_m" name="Sai so da hieu chinh (RTK)" stroke="blue" dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
