"""
Lay tuyen duong vong quanh Ho Hoan Kiem (Ha Noi) tu OpenStreetMap lam quy dao
"truth" cho rover, va dat nhieu tram base co dinh rai quanh vong duong
(mo phong mang luoi Network RTK / VRS).

Output:
  - data/truth_path.geojson   (Point, co seq + ts, la quy dao that theo thoi gian)
  - data/base_station.geojson (Point, vi tri cac tram base)

Neu co DATABASE_URL (trong .env), co the day thang len PostGIS bang --push-db.
"""
import argparse
from datetime import datetime, timedelta

import networkx as nx
import osmnx as ox
import geopandas as gpd
import numpy as np
from shapely.geometry import Point, LineString

# 4 con pho tao thanh vong quanh Ho Hoan Kiem
LAKE_LOOP_STREET_NAMES = {
    "Phố Đinh Tiên Hoàng",
    "Phố Lê Thái Tổ",
    "Phố Hàng Khay",
    "Phố Hồ Hoàn Kiếm",
}


def _name_matches(name, target_names: set) -> bool:
    if isinstance(name, list):
        return any(n in target_names for n in name)
    return name in target_names


def build_lake_loop_route(lat: float, lon: float, dist_m: int) -> LineString:
    """Lay mang luoi duong quanh (lat, lon), loc rieng cac doan thuoc
    LAKE_LOOP_STREET_NAMES, roi tim chu trinh (cycle) khep kin dai nhat trong
    do -> chinh la vong duong bao quanh ho."""
    G = ox.graph_from_point((lat, lon), dist=dist_m, network_type="all")

    H = nx.Graph()
    for u, v, data in G.edges(data=True):
        if _name_matches(data.get("name"), LAKE_LOOP_STREET_NAMES):
            H.add_edge(u, v, length=data.get("length", 0), geometry=data.get("geometry"))

    if H.number_of_nodes() == 0:
        raise RuntimeError(
            "Khong tim thay doan duong nao khop ten pho quanh Ho Hoan Kiem. "
            "Kiem tra lai toa do trung tam (--lat/--lon) hoac ban kinh (--dist)."
        )

    cycles = nx.cycle_basis(H)
    if not cycles:
        raise RuntimeError("Khong tim thay chu trinh khep kin nao trong mang luoi duong da loc.")

    def cycle_length(c):
        return sum(H[c[i]][c[(i + 1) % len(c)]]["length"] for i in range(len(c)))

    best_cycle = max(cycles, key=cycle_length)

    coords = []
    for i in range(len(best_cycle)):
        a, b = best_cycle[i], best_cycle[(i + 1) % len(best_cycle)]
        edge_geom = H[a][b].get("geometry")
        pa = (G.nodes[a]["x"], G.nodes[a]["y"])
        pb = (G.nodes[b]["x"], G.nodes[b]["y"])
        if edge_geom is not None:
            seg = list(edge_geom.coords)
            if Point(seg[0]).distance(Point(pb)) < Point(seg[0]).distance(Point(pa)):
                seg = seg[::-1]  # geometry di nguoc chieu a->b, dao lai
        else:
            seg = [pa, pb]
        if coords and coords[-1] == seg[0]:
            seg = seg[1:]
        coords.extend(seg)
    coords.append(coords[0])  # khep vong

    return LineString(coords)


def resample_line_to_points(line: LineString, speed_kmh: float, step_seconds: int,
                             start_time: datetime) -> gpd.GeoDataFrame:
    """Noi suy cac diem cach deu nhau theo thoi gian doc theo line, gia dinh
    rover di chuyen voi toc do khong doi speed_kmh."""
    line_m = gpd.GeoSeries([line], crs="EPSG:4326").to_crs(epsg=3857).iloc[0]

    speed_mps = speed_kmh * 1000 / 3600
    step_m = speed_mps * step_seconds
    total_len = line_m.length
    n_steps = max(int(total_len // step_m), 1)

    rows = []
    for i in range(n_steps + 1):
        d = min(i * step_m, total_len)
        pt_m = line_m.interpolate(d)
        pt = gpd.GeoSeries([pt_m], crs="EPSG:3857").to_crs(epsg=4326).iloc[0]
        rows.append({
            "seq": i,
            "ts": start_time + timedelta(seconds=i * step_seconds),
            "geometry": pt,
        })
    return gpd.GeoDataFrame(rows, crs="EPSG:4326")


def pick_base_stations(truth_points: gpd.GeoDataFrame, n_bases: int, baseline_m: float) -> gpd.GeoDataFrame:
    """Dat n_bases tram base rai deu quanh vong duong (tuong tu mang luoi Network
    RTK/VRS thuc te), moi tram lui ra ngoai baseline_m theo huong tam -> diem tren
    route, de bao quanh ho thay vi don le mot phia."""
    truth_m = truth_points.to_crs(epsg=3857)
    coords = np.array([[p.x, p.y] for p in truth_m.geometry])
    centroid = coords.mean(axis=0)

    idxs = np.linspace(0, len(coords), n_bases, endpoint=False).astype(int)
    rows = []
    for i, idx in enumerate(idxs):
        p = coords[idx]
        direction = p - centroid
        norm = np.linalg.norm(direction)
        unit = direction / norm if norm > 1e-6 else np.array([1.0, 0.0])
        base_m = p + unit * baseline_m
        base_pt = gpd.GeoSeries([Point(*base_m)], crs="EPSG:3857").to_crs(epsg=4326).iloc[0]
        rows.append({"name": f"base_station_{i + 1}", "geometry": base_pt})
    return gpd.GeoDataFrame(rows, crs="EPSG:4326")


def push_to_db(truth_gdf: gpd.GeoDataFrame, base_gdf: gpd.GeoDataFrame) -> None:
    import os
    from dotenv import load_dotenv
    from sqlalchemy import create_engine

    load_dotenv()
    db_url = os.environ["DATABASE_URL"]
    engine = create_engine(db_url)

    truth_gdf.rename_geometry("geom").to_postgis("truth_path", engine, if_exists="append", index=False)
    base_gdf.rename_geometry("geom").to_postgis("base_station", engine, if_exists="append", index=False)
    print("Da ghi truth_path va base_station vao PostGIS.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lat", type=float, default=21.0285, help="Vi do tam Ho Hoan Kiem")
    parser.add_argument("--lon", type=float, default=105.8524, help="Kinh do tam Ho Hoan Kiem")
    parser.add_argument("--dist", type=int, default=600, help="Ban kinh lay mang luoi duong (m)")
    parser.add_argument("--speed-kmh", type=float, default=30.0, help="Toc do gia dinh cua rover")
    parser.add_argument("--step-seconds", type=int, default=2, help="Khoang cach thoi gian giua 2 diem")
    parser.add_argument("--baseline-m", type=float, default=100.0, help="Khoang cach moi base ra ngoai vong duong")
    parser.add_argument("--n-bases", type=int, default=1, help="So luong tram base rai quanh vong duong")
    parser.add_argument("--push-db", action="store_true", help="Ghi thang ket qua vao PostGIS")
    args = parser.parse_args()

    print(f"Dang lay vong duong quanh Ho Hoan Kiem ({args.lat}, {args.lon}), ban kinh loc {args.dist}m...")
    line = build_lake_loop_route(args.lat, args.lon, args.dist)
    line_len_m = gpd.GeoSeries([line], crs="EPSG:4326").to_crs(epsg=3857).iloc[0].length
    print(f"Vong duong dai {line_len_m:.1f} m, so diem goc: {len(line.coords)}")

    truth_gdf = resample_line_to_points(
        line, args.speed_kmh, args.step_seconds, start_time=datetime(2026, 7, 30, 8, 0, 0)
    )
    print(f"Da resample thanh {len(truth_gdf)} diem truth_path.")

    base_gdf = pick_base_stations(truth_gdf, args.n_bases, args.baseline_m)
    print(f"Da dat {len(base_gdf)} tram base quanh vong duong.")

    truth_gdf.to_file("data/truth_path.geojson", driver="GeoJSON")
    base_gdf.to_file("data/base_station.geojson", driver="GeoJSON")
    print("Da luu data/truth_path.geojson va data/base_station.geojson")

    if args.push_db:
        push_to_db(truth_gdf, base_gdf)


if __name__ == "__main__":
    main()
