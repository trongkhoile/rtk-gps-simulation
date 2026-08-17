"""
Lay du lieu vector (duong, nuoc, nha) tu OpenStreetMap quanh Ho Hoan Kiem,
don gian hoa hinh hoc va luu thanh GeoJSON tinh de frontend tu ve rieng tung
lop (thay vi dung tile anh raster gop san khong the bat/tat tung lop).

Output: web/public/layers/{roads,water,buildings}.geojson
"""
import argparse
import json

import osmnx as ox
import geopandas as gpd


def round_coords(geom, ndigits=6):
    """Lam tron toa do de giam kich thuoc file GeoJSON (khong can do chinh xac
    hon ~0.11m o muc 6 chu so thap phan)."""
    from shapely.ops import transform

    def _round(x, y, z=None):
        return (round(x, ndigits), round(y, ndigits))

    return transform(_round, geom)


def save_geojson(gdf: gpd.GeoDataFrame, path: str, simplify_tol: float = 0.0):
    gdf = gdf[["geometry"]].copy()
    gdf = gdf[gdf.geometry.notnull()]
    if simplify_tol > 0:
        gdf["geometry"] = gdf.geometry.simplify(simplify_tol, preserve_topology=True)
    gdf["geometry"] = gdf.geometry.apply(round_coords)
    gdf.to_file(path, driver="GeoJSON")
    print(f"Da luu {path} ({len(gdf)} features)")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lat", type=float, default=21.0285)
    parser.add_argument("--lon", type=float, default=105.8524)
    parser.add_argument("--dist", type=int, default=600)
    parser.add_argument("--out-dir", default="web/public/layers")
    args = parser.parse_args()

    center = (args.lat, args.lon)

    print("Dang lay lop duong (roads)...")
    G = ox.graph_from_point(center, dist=args.dist, network_type="all")
    edges = ox.graph_to_gdfs(G, nodes=False)
    save_geojson(edges, f"{args.out_dir}/roads.geojson")

    print("Dang lay lop nuoc (water)...")
    water = ox.features_from_point(center, tags={"natural": "water"}, dist=args.dist)
    save_geojson(water, f"{args.out_dir}/water.geojson")

    print("Dang lay lop nha (buildings)...")
    buildings = ox.features_from_point(center, tags={"building": True}, dist=args.dist)
    save_geojson(buildings, f"{args.out_dir}/buildings.geojson", simplify_tol=0.00003)


if __name__ == "__main__":
    main()
