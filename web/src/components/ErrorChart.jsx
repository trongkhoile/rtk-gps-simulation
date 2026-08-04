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
          <ReferenceLine y={0.03} stroke="#2e7d32" strokeDasharray="2 4" label={{ value: "Fixed ≤3cm", position: "insideTopLeft", fontSize: 10, fill: "#2e7d32" }} />
          <ReferenceLine y={1.0} stroke="#e6a600" strokeDasharray="2 4" label={{ value: "Float ≤1m", position: "insideTopLeft", fontSize: 10, fill: "#e6a600" }} />
          <Line type="monotone" dataKey="error_raw_m" name="Sai so Single (GPS thuong)" stroke="red" dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="error_m" name="Sai so sau hieu chinh RTK" stroke="#1a56db" dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
