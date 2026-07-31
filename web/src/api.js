const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export async function fetchTruthPath() {
  const res = await fetch(`${API_BASE}/api/truth-path`);
  if (!res.ok) throw new Error("Khong the tai truth path");
  return res.json();
}

export async function fetchBaseStations() {
  const res = await fetch(`${API_BASE}/api/base-stations`);
  if (!res.ok) throw new Error("Khong the tai base stations");
  return res.json();
}

export async function runSimulate({ baseStations, sigmaBiasStep, sigmaLocal, baselinePpm, seed }) {
  const res = await fetch(`${API_BASE}/api/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      base_stations: baseStations,
      sigma_bias_step: sigmaBiasStep,
      sigma_local: sigmaLocal,
      baseline_ppm: baselinePpm,
      seed,
    }),
  });
  if (!res.ok) throw new Error("Mo phong that bai");
  return res.json();
}
