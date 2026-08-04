-- Schema cho project mo phong RTK
-- Chay tren PostGIS (Supabase da co san extension postgis, chi can bat)

CREATE EXTENSION IF NOT EXISTS postgis;

-- Tram base: vi tri "biet chinh xac" dung de tinh correction
DROP TABLE IF EXISTS base_station CASCADE;
CREATE TABLE base_station (
    id serial PRIMARY KEY,
    name text NOT NULL,
    geom geometry(Point, 4326) NOT NULL
);

-- Quy dao that cua rover, lay tu duong OpenStreetMap, resample theo thoi gian
DROP TABLE IF EXISTS truth_path CASCADE;
CREATE TABLE truth_path (
    id serial PRIMARY KEY,
    seq int NOT NULL,
    ts timestamp NOT NULL,
    geom geometry(Point, 4326) NOT NULL
);
CREATE INDEX idx_truth_path_geom ON truth_path USING GIST (geom);

-- Vi tri GPS do duoc (co nhieu), ca cac base va rover, chua hieu chinh
DROP TABLE IF EXISTS gps_raw CASCADE;
CREATE TABLE gps_raw (
    id serial PRIMARY KEY,
    seq int NOT NULL,
    ts timestamp NOT NULL,
    source text NOT NULL CHECK (source IN ('base', 'rover')),
    station_name text,  -- ten tram base (vd 'base_station_1'), NULL khi source='rover'
    geom geometry(Point, 4326) NOT NULL
);
CREATE INDEX idx_gps_raw_geom ON gps_raw USING GIST (geom);

-- Vi tri rover sau khi ap dung correction tu base gan nhat (mo phong Network RTK)
DROP TABLE IF EXISTS gps_corrected CASCADE;
CREATE TABLE gps_corrected (
    id serial PRIMARY KEY,
    seq int NOT NULL,
    ts timestamp NOT NULL,
    used_base text,  -- ten tram base duoc chon (gan rover nhat) tai thoi diem nay
    status text CHECK (status IN ('Fixed', 'Float', 'Single')),  -- trang thai nghiem RTK (Bang 2.5 tai lieu)
    geom geometry(Point, 4326) NOT NULL
);
CREATE INDEX idx_gps_corrected_geom ON gps_corrected USING GIST (geom);
