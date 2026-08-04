function truncate4(value) {
  return (Math.trunc(value * 10000) / 10000).toFixed(4);
}

const STATUS_COLOR = { Fixed: "#2e7d32", Float: "#e6a600", Single: "#c62828" };
const STATUS_REF = {
  Fixed: "1-3 cm",
  Float: "0.2-1.0 m",
  Single: "2.0-5.0 m",
};

function StatusBadge({ status }) {
  if (!status) return null;
  const color = STATUS_COLOR[status] || "#666";
  return (
    <span className="status-badge" style={{ background: color }}>
      {status}
    </span>
  );
}

export default function Metrics({ rmseRaw, rmseCorrected, improvement, statusPct, currentStatus }) {
  return (
    <div>
      <div className="metrics-row">
        <div className="metric">
          <div className="metric-label">RMSE GPS thuong (Single, do ma)</div>
          <div className="metric-value">{truncate4(rmseRaw)} m</div>
        </div>
        <div className="metric">
          <div className="metric-label">RMSE sau hieu chinh (RTK, do pha)</div>
          <div className="metric-value">{truncate4(rmseCorrected)} m</div>
        </div>
        <div className="metric">
          <div className="metric-label">Cai thien</div>
          <div className="metric-value">{improvement.toFixed(1)}%</div>
        </div>
        <div className="metric">
          <div className="metric-label">Trang thai hien tai</div>
          <div className="metric-value"><StatusBadge status={currentStatus} /></div>
        </div>
      </div>

      {statusPct && (
        <div className="status-distribution">
          {["Fixed", "Float", "Single"].map((s) => (
            <div key={s} className="status-row">
              <span className="status-dot" style={{ background: STATUS_COLOR[s] }} />
              <span className="status-name">{s}</span>
              <span className="status-pct">{statusPct[s].toFixed(1)}%</span>
              <span className="status-ref">(chuan tai lieu: {STATUS_REF[s]})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
