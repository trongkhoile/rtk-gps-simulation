"""
API backend cho dashboard React mo phong RTK.
Boc lai logic mo phong da co san trong simulate/generate_gps_noise.py -
khong viet lai cong thuc, chi expose qua HTTP JSON.

Chay: uvicorn backend.main:app --reload --port 8000   (chay tu thu muc goc project)
"""
import sys
from pathlib import Path
from typing import List, Optional

import geopandas as gpd
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from shapely.geometry import Point

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from simulate.generate_gps_noise import simulate  # noqa: E402

app = FastAPI(title="RTK Simulation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _load_data():
    truth_gdf = gpd.read_file(ROOT / "data" / "truth_path.geojson")
    base_gdf = gpd.read_file(ROOT / "data" / "base_station.geojson")
    return truth_gdf, base_gdf


TRUTH_GDF, DEFAULT_BASE_GDF = _load_data()


class BaseStationIn(BaseModel):
    name: str
    lat: float
    lon: float


class SimulateRequest(BaseModel):
    base_stations: Optional[List[BaseStationIn]] = None
    sigma_bias_step: float = 0.3
    sigma_local: float = 0.02
    baseline_ppm: float = 0.001
    seed: int = 42
    age_seconds: float = 1.0


@app.get("/api/truth-path")
def get_truth_path():
    return [
        {"seq": int(row.seq), "ts": str(row.ts), "lat": row.geometry.y, "lon": row.geometry.x}
        for row in TRUTH_GDF.itertuples()
    ]


@app.get("/api/base-stations")
def get_base_stations():
    return [
        {"name": row.name, "lat": row.geometry.y, "lon": row.geometry.x}
        for row in DEFAULT_BASE_GDF.itertuples()
    ]


@app.post("/api/simulate")
def post_simulate(req: SimulateRequest):
    if req.base_stations:
        base_gdf = gpd.GeoDataFrame(
            {
                "name": [b.name for b in req.base_stations],
                "geometry": [Point(b.lon, b.lat) for b in req.base_stations],
            },
            crs="EPSG:4326",
        )
    else:
        base_gdf = DEFAULT_BASE_GDF

    if len(base_gdf) == 0:
        raise HTTPException(400, "Can it nhat 1 base station")

    gps_raw_gdf, gps_corrected_gdf = simulate(
        TRUTH_GDF, base_gdf, utm_epsg=32648,
        sigma_bias_step=req.sigma_bias_step, sigma_local=req.sigma_local,
        baseline_ppm=req.baseline_ppm, seed=req.seed, age_seconds=req.age_seconds,
    )

    rover_gdf = gps_raw_gdf[gps_raw_gdf["source"] == "rover"]
    bases_out = {}
    for name, grp in gps_raw_gdf[gps_raw_gdf["source"] == "base"].groupby("station_name"):
        bases_out[name] = [
            {"seq": int(r.seq), "lat": r.geometry.y, "lon": r.geometry.x} for r in grp.itertuples()
        ]

    rmse_raw = float(np.sqrt(np.mean(gps_corrected_gdf["error_raw_m"] ** 2)))
    rmse_corrected = float(np.sqrt(np.mean(gps_corrected_gdf["error_m"] ** 2)))
    improvement = (1 - rmse_corrected / rmse_raw) * 100 if rmse_raw > 0 else 0.0
    status_counts = gps_corrected_gdf["status"].value_counts()
    n_points = len(gps_corrected_gdf)
    status_pct = {
        s: float(status_counts.get(s, 0)) / n_points * 100 for s in ["Fixed", "Float", "Single"]
    }

    return {
        "rmse_raw": rmse_raw,
        "rmse_corrected": rmse_corrected,
        "improvement": improvement,
        "status_pct": status_pct,
        "age_seconds": req.age_seconds,
        "base_stations": [
            {"name": row.name, "lat": row.geometry.y, "lon": row.geometry.x} for row in base_gdf.itertuples()
        ],
        "gps_raw_rover": [
            {"seq": int(r.seq), "lat": r.geometry.y, "lon": r.geometry.x} for r in rover_gdf.itertuples()
        ],
        "gps_raw_bases": bases_out,
        "gps_corrected": [
            {
                "seq": int(r.seq), "lat": r.geometry.y, "lon": r.geometry.x,
                "used_base": r.used_base, "error_raw_m": r.error_raw_m, "error_m": r.error_m,
                "status": r.status,
            }
            for r in gps_corrected_gdf.itertuples()
        ],
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
