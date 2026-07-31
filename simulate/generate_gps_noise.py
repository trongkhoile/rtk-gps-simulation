"""
Mo phong sai so GPS thuong (raw) va hieu chinh kieu Network RTK / VRS (corrected)
voi nhieu tram base rai quanh tuyen duong.

Mo hinh sai so tai moi thoi diem t:
    measured_rover(t) = truth(t) + common_bias(t) + local_noise_rover(t)   # GPS thuong, khong lien quan base nao

    Voi moi tram base i:
        measured_base_i(t)  = base_i + common_bias(t) + local_noise_base_i(t)
        correction_i(t)      = base_i - measured_base_i(t)
        baseline_divergence_i(t) ~ N(0, (baseline_ppm * dist(rover(t), base_i)/1000)^2)
            # phan common_bias khong hoan toan giong nhau giua rover va base i,
            # lech nhieu hon khi 2 diem cang xa nhau
        corrected_via_i(t)  = measured_rover(t) + correction_i(t) + baseline_divergence_i(t)
                             = truth(t) + local_noise_rover(t) - local_noise_base_i(t) + baseline_divergence_i(t)

Tai moi thoi diem, rover dung correction cua tram base GAN NHAT (kieu Network
RTK/VRS thuc te) thay vi chi 1 base co dinh -> baseline_divergence luon nho vi
luon co 1 base gan trong ban kinh, du rover di het vong quanh ho.

Input:  data/truth_path.geojson, data/base_station.geojson (nhieu tram)
Output: data/gps_raw.geojson, data/gps_corrected.geojson, in ra RMSE raw vs corrected
"""
import argparse

import numpy as np
import geopandas as gpd
import pandas as pd
from shapely.geometry import Point

UTM_EPSG_DEFAULT = 32648  # UTM 48N, phu hop khu vuc Ha Noi


def random_walk(n: int, step_std: float, rng: np.random.Generator) -> np.ndarray:
    """Random walk 2D (dx, dy) tich luy theo n buoc, dai dien common_bias."""
    steps = rng.normal(0, step_std, size=(n, 2))
    return np.cumsum(steps, axis=0)


def simulate(truth_gdf: gpd.GeoDataFrame, base_gdf: gpd.GeoDataFrame, utm_epsg: int,
             sigma_bias_step: float, sigma_local: float, baseline_ppm: float,
             seed: int) -> tuple[gpd.GeoDataFrame, gpd.GeoDataFrame]:
    rng = np.random.default_rng(seed)
    n = len(truth_gdf)
    n_bases = len(base_gdf)

    truth_m = truth_gdf.to_crs(epsg=utm_epsg)
    base_m = base_gdf.to_crs(epsg=utm_epsg)

    truth_xy = np.array([[p.x, p.y] for p in truth_m.geometry])            # (n, 2)
    base_xy = np.array([[p.x, p.y] for p in base_m.geometry])              # (n_bases, 2)
    base_names = base_gdf["name"].tolist() if "name" in base_gdf.columns else [
        f"base_station_{i + 1}" for i in range(n_bases)
    ]

    common_bias = random_walk(n, sigma_bias_step, rng)                     # (n,2), dung chung moi noi
    local_noise_rover = rng.normal(0, sigma_local, size=(n, 2))
    local_noise_base = rng.normal(0, sigma_local, size=(n_bases, n, 2))    # doc lap tung base

    measured_rover_xy = truth_xy + common_bias + local_noise_rover         # GPS thuong (raw), khong qua base
    err_raw = np.linalg.norm(measured_rover_xy - truth_xy, axis=1)

    dist_to_bases = np.linalg.norm(truth_xy[None, :, :] - base_xy[:, None, :], axis=2)  # (n_bases, n)
    nearest_base_idx = np.argmin(dist_to_bases, axis=0)                    # (n,)

    sigma_div = baseline_ppm * dist_to_bases / 1000.0                      # (n_bases, n)
    baseline_divergence = rng.normal(0, 1, size=(n_bases, n, 2)) * sigma_div[:, :, None]

    correction = -common_bias[None, :, :] - local_noise_base               # (n_bases, n, 2)
    corrected_via = measured_rover_xy[None, :, :] + correction + baseline_divergence  # (n_bases, n, 2)

    t_idx = np.arange(n)
    corrected_rover_xy = corrected_via[nearest_base_idx, t_idx, :]         # (n, 2)
    used_base = np.array(base_names)[nearest_base_idx]

    err_corrected = np.linalg.norm(corrected_rover_xy - truth_xy, axis=1)
    print(f"So tram base: {n_bases}")
    print(f"RMSE GPS thuong (raw):        {np.sqrt(np.mean(err_raw**2)):.3f} m")
    print(f"RMSE sau hieu chinh (RTK):    {np.sqrt(np.mean(err_corrected**2)):.3f} m")
    print(f"Cai thien: {(1 - np.sqrt(np.mean(err_corrected**2)) / np.sqrt(np.mean(err_raw**2))) * 100:.1f}%")

    def xy_to_gdf(xy, seq, ts, extra=None):
        pts = gpd.GeoSeries([Point(x, y) for x, y in xy], crs=f"EPSG:{utm_epsg}").to_crs(epsg=4326)
        data = {"seq": seq, "ts": ts, "geometry": pts.values}
        if extra:
            data.update(extra)
        return gpd.GeoDataFrame(data, crs="EPSG:4326")

    seq = truth_gdf["seq"].values
    ts = truth_gdf["ts"].values

    raw_rover_gdf = xy_to_gdf(
        measured_rover_xy, seq, ts, {"source": ["rover"] * n, "station_name": [None] * n}
    )
    raw_base_parts = []
    for i in range(n_bases):
        measured_base_i_xy = base_xy[i] + common_bias + local_noise_base[i]
        raw_base_parts.append(xy_to_gdf(
            measured_base_i_xy, seq, ts,
            {"source": ["base"] * n, "station_name": [base_names[i]] * n},
        ))
    gps_raw_gdf = pd.concat([raw_rover_gdf] + raw_base_parts, ignore_index=True)
    gps_raw_gdf = gpd.GeoDataFrame(gps_raw_gdf, crs="EPSG:4326")

    gps_corrected_gdf = xy_to_gdf(
        corrected_rover_xy, seq, ts, {"used_base": used_base, "error_m": err_corrected}
    )
    gps_corrected_gdf["error_raw_m"] = err_raw

    return gps_raw_gdf, gps_corrected_gdf


def push_to_db(gps_raw_gdf: gpd.GeoDataFrame, gps_corrected_gdf: gpd.GeoDataFrame) -> None:
    import os
    from dotenv import load_dotenv
    from sqlalchemy import create_engine

    load_dotenv()
    db_url = os.environ["DATABASE_URL"]
    engine = create_engine(db_url)

    gps_raw_gdf[["seq", "ts", "source", "station_name", "geometry"]].rename_geometry("geom").to_postgis(
        "gps_raw", engine, if_exists="append", index=False
    )
    gps_corrected_gdf[["seq", "ts", "used_base", "geometry"]].rename_geometry("geom").to_postgis(
        "gps_corrected", engine, if_exists="append", index=False
    )
    print("Da ghi gps_raw va gps_corrected vao PostGIS.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--utm-epsg", type=int, default=UTM_EPSG_DEFAULT)
    parser.add_argument("--sigma-bias-step", type=float, default=0.3,
                         help="Do lech chuan (m) moi buoc cua common_bias random walk")
    parser.add_argument("--sigma-local", type=float, default=0.02,
                         help="Do lech chuan (m) nhieu cuc bo (multipath) tung may thu (RTK carrier-phase thuc te ~0.01-0.02m)")
    parser.add_argument("--baseline-ppm", type=float, default=0.001,
                         help="He so suy giam tuong quan theo khoang cach base-rover (m/km). "
                              "1 ppm (chuan datasheet RTK that) = 0.001 m/km")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--push-db", action="store_true")
    args = parser.parse_args()

    truth_gdf = gpd.read_file("data/truth_path.geojson")
    base_gdf = gpd.read_file("data/base_station.geojson")

    gps_raw_gdf, gps_corrected_gdf = simulate(
        truth_gdf, base_gdf, args.utm_epsg,
        args.sigma_bias_step, args.sigma_local, args.baseline_ppm, args.seed,
    )

    gps_raw_gdf.to_file("data/gps_raw.geojson", driver="GeoJSON")
    gps_corrected_gdf.to_file("data/gps_corrected.geojson", driver="GeoJSON")
    print("Da luu data/gps_raw.geojson va data/gps_corrected.geojson")

    if args.push_db:
        push_to_db(gps_raw_gdf, gps_corrected_gdf)


if __name__ == "__main__":
    main()
