import { useEffect, useMemo, useState } from "react";
import { MapContainer, Polyline, CircleMarker, Marker, Tooltip, GeoJSON, useMapEvents } from "react-leaflet";
import { divIcon } from "leaflet";

const baseIcon = divIcon({
  html: '<div style="font-size:22px;line-height:22px;width:24px;text-align:center">🏠</div>',
  className: "",
  iconSize: [24, 24],
  iconAnchor: [12, 22],
});

const STATUS_COLOR = { Fixed: "#2e7d32", Float: "#e6a600", Single: "#c62828" };

const BASEMAP_LAYER_DEFS = [
  { key: "buildings", label: "Lớp nhà", swatch: "#cabfa3" },
  { key: "water", label: "Lớp nước", swatch: "#9fc4de" },
  { key: "roads", label: "Lớp đường", swatch: "#8a8894" },
];
const SIM_LAYER_DEFS = [
  { key: "truth", label: "Quỹ đạo thật", swatch: "green" },
  { key: "raw", label: "GPS thường (Single)", swatch: "red" },
  { key: "corrected", label: "GPS đã hiệu chỉnh (RTK)", swatch: "#2e7d32" },
  { key: "base", label: "Trạm Base + đường nối", swatch: "#333" },
];

const BUILDINGS_STYLE = { color: "#c9c2b4", weight: 0.5, fillColor: "#e8e3d8", fillOpacity: 0.9 };
const WATER_STYLE = { color: "#a8c8e0", weight: 1, fillColor: "#cfe3f0", fillOpacity: 0.95 };
const ROADS_STYLE = { color: "#b0aeb8", weight: 1.5 };

function ClickCatcher({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function LayerControl({ layers, onToggle }) {
  return (
    <div className="layer-control">
      <div className="layer-control-group-label">Lớp bản đồ nền</div>
      {BASEMAP_LAYER_DEFS.map((l) => (
        <label key={l.key} className="layer-control-row">
          <input type="checkbox" checked={layers[l.key]} onChange={() => onToggle(l.key)} />
          <span className="layer-swatch" style={{ background: l.swatch }} />
          {l.label}
        </label>
      ))}
      <div className="layer-control-group-label">Lớp mô phỏng</div>
      {SIM_LAYER_DEFS.map((l) => (
        <label key={l.key} className="layer-control-row">
          <input type="checkbox" checked={layers[l.key]} onChange={() => onToggle(l.key)} />
          <span className="layer-swatch" style={{ background: l.swatch }} />
          {l.label}
        </label>
      ))}
    </div>
  );
}

export default function MapView({ truthPath, baseStations, simResult, stepIdx, onMapClick, pendingClick }) {
  const [layers, setLayers] = useState({
    truth: true, raw: true, corrected: true, base: true,
    roads: true, water: true, buildings: true,
  });
  const toggleLayer = (key) => setLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  const [baseGeo, setBaseGeo] = useState({ roads: null, water: null, buildings: null });
  useEffect(() => {
    Promise.all([
      fetch("/layers/roads.geojson").then((r) => r.json()),
      fetch("/layers/water.geojson").then((r) => r.json()),
      fetch("/layers/buildings.geojson").then((r) => r.json()),
    ])
      .then(([roads, water, buildings]) => setBaseGeo({ roads, water, buildings }))
      .catch(() => {});
  }, []);

  const center = useMemo(() => {
    if (!truthPath.length) return [21.0285, 105.8524];
    const lat = truthPath.reduce((s, p) => s + p.lat, 0) / truthPath.length;
    const lon = truthPath.reduce((s, p) => s + p.lon, 0) / truthPath.length;
    return [lat, lon];
  }, [truthPath]);

  const truthLine = truthPath.map((p) => [p.lat, p.lon]);
  const rawPoints = simResult ? simResult.gps_raw_rover.slice(0, stepIdx + 1) : [];
  const correctedPoints = simResult ? simResult.gps_corrected.slice(0, stepIdx + 1) : [];
  const currentTruth = truthPath[stepIdx];
  const currentCorrected = simResult ? simResult.gps_corrected[stepIdx] : null;
  const usedBaseRow =
    currentCorrected && simResult ? simResult.base_stations.find((b) => b.name === currentCorrected.used_base) : null;

  return (
    <div style={{ position: "relative" }}>
      <LayerControl layers={layers} onToggle={toggleLayer} />
      <div className="map-attribution">© OpenStreetMap contributors</div>
      <MapContainer center={center} zoom={16} attributionControl={false} style={{ height: 560, width: "100%", background: "#f4f2ec" }}>
        <ClickCatcher onMapClick={onMapClick} />

        {layers.buildings && baseGeo.buildings && <GeoJSON data={baseGeo.buildings} style={() => BUILDINGS_STYLE} />}
        {layers.water && baseGeo.water && <GeoJSON data={baseGeo.water} style={() => WATER_STYLE} />}
        {layers.roads && baseGeo.roads && <GeoJSON data={baseGeo.roads} style={() => ROADS_STYLE} />}

        {layers.truth && truthLine.length > 0 && (
          <Polyline positions={truthLine} pathOptions={{ color: "green", weight: 3 }} />
        )}

        {layers.base && baseStations.map((b) => (
          <Marker key={b.name} position={[b.lat, b.lon]} icon={baseIcon}>
            <Tooltip>Base: {b.name}</Tooltip>
          </Marker>
        ))}

        {pendingClick && (
          <CircleMarker
            center={[pendingClick.lat, pendingClick.lon]}
            radius={8}
            pathOptions={{ color: "orange", fillColor: "orange", fillOpacity: 0.9 }}
          />
        )}

        {layers.base && usedBaseRow && currentTruth && (
          <Polyline
            positions={[
              [currentTruth.lat, currentTruth.lon],
              [usedBaseRow.lat, usedBaseRow.lon],
            ]}
            pathOptions={{ color: "black", weight: 1, dashArray: "4" }}
          />
        )}

        {layers.raw && rawPoints.map((p) => (
          <CircleMarker
            key={`raw-${p.seq}`}
            center={[p.lat, p.lon]}
            radius={2}
            pathOptions={{ color: "red", fillColor: "red", fillOpacity: 0.7 }}
          />
        ))}

        {layers.corrected && correctedPoints.map((p) => {
          const color = STATUS_COLOR[p.status] || "blue";
          return (
            <CircleMarker
              key={`corr-${p.seq}`}
              center={[p.lat, p.lon]}
              radius={2}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.8 }}
            >
              <Tooltip>{p.status} — {p.error_m.toFixed(3)}m</Tooltip>
            </CircleMarker>
          );
        })}

        {layers.truth && currentTruth && (
          <CircleMarker
            center={[currentTruth.lat, currentTruth.lon]}
            radius={6}
            pathOptions={{ color: "green", fillColor: "green", fillOpacity: 1 }}
          />
        )}
      </MapContainer>
    </div>
  );
}
