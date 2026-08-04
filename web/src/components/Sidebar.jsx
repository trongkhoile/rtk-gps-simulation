export default function Sidebar({
  sigmaBiasStep, setSigmaBiasStep,
  sigmaLocal, setSigmaLocal,
  baselinePpm, setBaselinePpm,
  ageSeconds, setAgeSeconds,
  seed, setSeed,
  onRun, running,
  onResetBases,
}) {
  return (
    <div className="sidebar">
      <h3>Tham so mo hinh sai so GNSS</h3>

      <label className="field">
        <div className="field-label">
          Sai so khi quyen &amp; quy dao (dien ly/doi luu/ve tinh), m <span className="value">{sigmaBiasStep.toFixed(2)}</span>
        </div>
        <input
          type="range" min="0" max="1" step="0.05"
          value={sigmaBiasStep}
          onChange={(e) => setSigmaBiasStep(parseFloat(e.target.value))}
        />
        <div className="field-hint">Chung giua Base &amp; Rover — triet tieu duoc bang ky thuat sai phan (Double Difference)</div>
      </label>

      <label className="field">
        <div className="field-label">Nhieu multipath / may thu (m)</div>
        <input
          type="number" min="0" max="1" step="0.001"
          value={sigmaLocal}
          onChange={(e) => setSigmaLocal(parseFloat(e.target.value))}
        />
        <div className="field-hint">Doc lap tung may thu — KHONG triet tieu duoc bang sai phan, la san sai so cuoi cung cua Fixed</div>
      </label>

      <label className="field">
        <div className="field-label">Suy giam theo khoang cach Base-Rover (ppm, m/km)</div>
        <input
          type="number" min="0" max="3" step="0.001"
          value={baselinePpm}
          onChange={(e) => setBaselinePpm(parseFloat(e.target.value))}
        />
        <div className="field-hint">Datasheet RTK thuc te: ±(8mm + 1ppm×D). Single-base RTK hieu qua nhat trong 10-20km</div>
      </label>

      <label className="field">
        <div className="field-label">Age of Differential — tuoi du lieu hieu chinh (s)</div>
        <input
          type="number" min="0" max="30" step="0.5"
          value={ageSeconds}
          onChange={(e) => setAgeSeconds(parseFloat(e.target.value))}
        />
        <div className="field-hint">&lt;2s: Fixed on dinh &nbsp;|&nbsp; 2-5s: chap nhan duoc &nbsp;|&nbsp; &gt;10s: de mat Fixed</div>
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

      <h3 style={{ marginTop: 24 }}>Di chuyen tram Base</h3>
      <p className="hint">Click vao 1 diem tren ban do, chon base can di chuyen roi bam nut xac nhan ben duoi ban do.</p>
      <button className="btn-secondary" onClick={onResetBases}>Dat lai vi tri goc cua tat ca base</button>
    </div>
  );
}
