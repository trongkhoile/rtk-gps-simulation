import { useMemo } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Tooltip, useMapEvents } from "react-leaflet";
import { divIcon } from "leaflet";

const baseIcon = divIcon({
  html: '<div style="font-size:22px;line-height:22px;width:24px;text-align:center">🏠</div>',
  className: "",
  iconSize: [24, 24],
  iconAnchor: [12, 22],
});

const STATUS_COLOR = { Fixed: "#2e7d32", Float: "#e6a600", Single: "#c62828" };

function ClickCatcher({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapView({ truthPath, baseStations, simResult, stepIdx, onMapClick, pendingClick }) {
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
    <MapContainer center={center} zoom={16} style={{ height: 560, width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickCatcher onMapClick={onMapClick} />

      {truthLine.length > 0 && <Polyline positions={truthLine} pathOptions={{ color: "green", weight: 3 }} />}

      {baseStations.map((b) => (
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

      {usedBaseRow && currentTruth && (
        <Polyline
          positions={[
            [currentTruth.lat, currentTruth.lon],
            [usedBaseRow.lat, usedBaseRow.lon],
          ]}
          pathOptions={{ color: "black", weight: 1, dashArray: "4" }}
        />
      )}

      {rawPoints.map((p) => (
        <CircleMarker
          key={`raw-${p.seq}`}
          center={[p.lat, p.lon]}
          radius={2}
          pathOptions={{ color: "red", fillColor: "red", fillOpacity: 0.7 }}
        />
      ))}

      {correctedPoints.map((p) => {
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

      {currentTruth && (
        <CircleMarker
          center={[currentTruth.lat, currentTruth.lon]}
          radius={6}
          pathOptions={{ color: "green", fillColor: "green", fillOpacity: 1 }}
        />
      )}
    </MapContainer>
  );
}
