export default function Sidebar({
  sigmaBiasStep, setSigmaBiasStep,
  sigmaLocal, setSigmaLocal,
  baselinePpm, setBaselinePpm,
  seed, setSeed,
  onRun, running,
  onResetBases,
}) {
  return (
    <div className="sidebar">
      <h3>Tham so mo phong nhieu</h3>

      <label className="field">
        <div className="field-label">
          Do bien thien common bias moi buoc (m) <span className="value">{sigmaBiasStep.toFixed(2)}</span>
        </div>
        <input
          type="range" min="0" max="1" step="0.05"
          value={sigmaBiasStep}
          onChange={(e) => setSigmaBiasStep(parseFloat(e.target.value))}
        />
      </label>

      <label className="field">
        <div className="field-label">Nhieu cuc bo tung may thu (m)</div>
        <input
          type="number" min="0" max="1" step="0.001"
          value={sigmaLocal}
          onChange={(e) => setSigmaLocal(parseFloat(e.target.value))}
        />
      </label>

      <label className="field">
        <div className="field-label">Suy giam theo khoang cach base-rover (m/km)</div>
        <input
          type="number" min="0" max="3" step="0.001"
          value={baselinePpm}
          onChange={(e) => setBaselinePpm(parseFloat(e.target.value))}
        />
      </label>

      <label className="field">
        <div className="field-label">Random seed</div>
        <input
          type="number" step="1"
          value={seed}
          onChange={(e) => setSeed(parseInt(e.target.value || "0", 10))}
        />
      </label>

      <button className="btn-primary" onClick={onRun} disabled={running}>
        {running ? "Dang chay..." : "Chay mo phong"}
      </button>

      <h3 style={{ marginTop: 24 }}>Di chuyen base station</h3>
      <p className="hint">Click vao 1 diem tren ban do, chon base can di chuyen roi bam nut xac nhan ben duoi ban do.</p>
      <button className="btn-secondary" onClick={onResetBases}>Dat lai vi tri goc cua tat ca base</button>
    </div>
  );
}
