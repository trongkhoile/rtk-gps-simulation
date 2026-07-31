function truncate4(value) {
  return (Math.trunc(value * 10000) / 10000).toFixed(4);
}

export default function Metrics({ rmseRaw, rmseCorrected, improvement }) {
  return (
    <div className="metrics-row">
      <div className="metric">
        <div className="metric-label">RMSE GPS thuong (raw)</div>
        <div className="metric-value">{truncate4(rmseRaw)} m</div>
      </div>
      <div className="metric">
        <div className="metric-label">RMSE sau hieu chinh (RTK)</div>
        <div className="metric-value">{truncate4(rmseCorrected)} m</div>
      </div>
      <div className="metric">
        <div className="metric-label">Cai thien</div>
        <div className="metric-value">{improvement.toFixed(1)}%</div>
      </div>
    </div>
  );
}
