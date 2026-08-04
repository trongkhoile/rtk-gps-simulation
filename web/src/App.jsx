import { useEffect, useState, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import MapView from "./components/MapView";
import Metrics from "./components/Metrics";
import ErrorChart from "./components/ErrorChart";
import { fetchTruthPath, fetchBaseStations, runSimulate } from "./api";
import "./App.css";

export default function App() {
  const [truthPath, setTruthPath] = useState([]);
  const [originalBases, setOriginalBases] = useState([]);
  const [baseStations, setBaseStations] = useState([]);
  const [simResult, setSimResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const [sigmaBiasStep, setSigmaBiasStep] = useState(0.3);
  const [sigmaLocal, setSigmaLocal] = useState(0.02);
  const [baselinePpm, setBaselinePpm] = useState(0.001);
  const [ageSeconds, setAgeSeconds] = useState(1.0);
  const [seed, setSeed] = useState(42);
  const [stepIdx, setStepIdx] = useState(0);

  const [pendingClick, setPendingClick] = useState(null);
  const [moveTarget, setMoveTarget] = useState("");

  const doSimulate = useCallback(async (bases, params) => {
    setRunning(true);
    setError(null);
    try {
      const result = await runSimulate({
        baseStations: bases,
        sigmaBiasStep: params.sigmaBiasStep,
        sigmaLocal: params.sigmaLocal,
        baselinePpm: params.baselinePpm,
        seed: params.seed,
        ageSeconds: params.ageSeconds,
      });
      setSimResult(result);
      setStepIdx(result.gps_corrected.length - 1);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [tp, bs] = await Promise.all([fetchTruthPath(), fetchBaseStations()]);
        setTruthPath(tp);
        setOriginalBases(bs);
        setBaseStations(bs);
        setMoveTarget(bs[0]?.name ?? "");
        await doSimulate(bs, { sigmaBiasStep: 0.3, sigmaLocal: 0.02, baselinePpm: 0.001, seed: 42, ageSeconds: 1.0 });
      } catch (e) {
        setError(String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRun = () => {
    doSimulate(baseStations, { sigmaBiasStep, sigmaLocal, baselinePpm, seed, ageSeconds });
  };

  const handleResetBases = () => {
    setBaseStations(originalBases);
    setPendingClick(null);
    doSimulate(originalBases, { sigmaBiasStep, sigmaLocal, baselinePpm, seed, ageSeconds });
  };

  const handleMapClick = (lat, lon) => {
    setPendingClick({ lat, lon });
  };

  const handleConfirmMove = () => {
    if (!pendingClick || !moveTarget) return;
    const updated = baseStations.map((b) =>
      b.name === moveTarget ? { ...b, lat: pendingClick.lat, lon: pendingClick.lon } : b
    );
    setBaseStations(updated);
    setPendingClick(null);
    doSimulate(updated, { sigmaBiasStep, sigmaLocal, baselinePpm, seed, ageSeconds });
  };

  return (
    <div className="app">
      <Sidebar
        sigmaBiasStep={sigmaBiasStep} setSigmaBiasStep={setSigmaBiasStep}
        sigmaLocal={sigmaLocal} setSigmaLocal={setSigmaLocal}
        baselinePpm={baselinePpm} setBaselinePpm={setBaselinePpm}
        ageSeconds={ageSeconds} setAgeSeconds={setAgeSeconds}
        seed={seed} setSeed={setSeed}
        onRun={handleRun} running={running}
        onResetBases={handleResetBases}
      />

      <div className="main">
        <h1>Mo phong RTK giam sai so dinh vi GPS</h1>
        <p className="caption">
          GPS thuong (Single) dinh vi bang <b>do ma</b> (Code Phase), sai so vai met. RTK dung <b>do pha song mang</b>
          (Carrier Phase) ket hop ky thuat sai phan voi tram Base da biet toa do, loai bo sai so chung
          (dien ly, doi luu, dong ho ve tinh) de dat do chinh xac centimet. Neu co nhieu tram Base, tai moi thoi
          diem Rover tu dong dung correction cua tram GAN NHAT (mo hinh Network RTK/VRS).
        </p>

        {error && <div className="error-box">{error}</div>}

        {simResult && (
          <>
            <Metrics
              rmseRaw={simResult.rmse_raw}
              rmseCorrected={simResult.rmse_corrected}
              improvement={simResult.improvement}
              statusPct={simResult.status_pct}
              currentStatus={simResult.gps_corrected[stepIdx]?.status}
            />

            <div className="field" style={{ margin: "16px 0" }}>
              <div className="field-label">Thoi diem (seq) <span className="value">{stepIdx}</span></div>
              <input
                type="range" min="0" max={simResult.gps_corrected.length - 1} step="1"
                value={stepIdx}
                onChange={(e) => setStepIdx(parseInt(e.target.value, 10))}
                style={{ width: "100%" }}
              />
            </div>

            <div className="legend">
              Duong xanh la = quy dao that &nbsp;|&nbsp; Cham do nho = GPS thuong (Single) &nbsp;|&nbsp;
              Cham RTK: <span style={{ color: "#2e7d32", fontWeight: 600 }}>Fixed</span> /{" "}
              <span style={{ color: "#e6a600", fontWeight: 600 }}>Float</span> /{" "}
              <span style={{ color: "#c62828", fontWeight: 600 }}>Single</span>
              &nbsp;|&nbsp; Nha = tram base &nbsp;|&nbsp; Net dut = base dang duoc dung
            </div>

            <div className="content-row">
              <div className="map-col">
                <MapView
                  truthPath={truthPath}
                  baseStations={baseStations}
                  simResult={simResult}
                  stepIdx={stepIdx}
                  onMapClick={handleMapClick}
                  pendingClick={pendingClick}
                />

                {pendingClick ? (
                  <div className="move-panel">
                    <span>Vi tri vua click: {pendingClick.lat.toFixed(5)}, {pendingClick.lon.toFixed(5)}</span>
                    <select value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)}>
                      {baseStations.map((b) => (
                        <option key={b.name} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                    <button className="btn-primary" onClick={handleConfirmMove}>Xac nhan di chuyen</button>
                  </div>
                ) : (
                  <div className="move-panel hint">Click vao 1 diem tren ban do de chon vi tri moi cho base station.</div>
                )}
              </div>

              <div className="chart-col">
                <ErrorChart data={simResult.gps_corrected} stepIdx={stepIdx} />
              </div>
            </div>

            <p className="footnote">
              Nguong Age of Differential (Bang 2.4) va phan loai trang thai Single/Float/Fixed (Bang 2.5) tham khao
              theo bao cao "Tong quan ve GPS va RTK", Truong Dien - Dien tu, Dai hoc Bach Khoa Ha Noi, 5/2025.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
