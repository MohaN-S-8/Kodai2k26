import { useEffect, useRef, useState } from "react";
import { loadLeaflet } from "../utils/leaflet";

const STAY_MAP_URL = import.meta.env.VITE_STAY_MAP_URL || "";
const STAY_LAT = Number(import.meta.env.VITE_STAY_MAP_LAT || 10.2604);
const STAY_LNG = Number(import.meta.env.VITE_STAY_MAP_LNG || 77.4958);
const STAY_COORDINATE = [STAY_LAT, STAY_LNG];

function StayMapPreview() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function renderMap() {
      try {
        const L = await loadLeaflet();
        if (cancelled || !mapRef.current) {
          return;
        }

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
        }

        const map = L.map(mapRef.current, {
          zoomControl: true,
          scrollWheelZoom: false,
        }).setView(STAY_COORDINATE, 15);
        mapInstanceRef.current = map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);

        const riderIcon = L.icon({
          iconUrl: "/images/trip-rider.png",
          iconSize: [96, 72],
          iconAnchor: [48, 58],
          popupAnchor: [0, -56],
          tooltipAnchor: [0, -58],
        });

        const marker = L.marker(STAY_COORDINATE, { icon: riderIcon }).addTo(map);
        marker.bindTooltip("Zion Elite Residency", {
          permanent: true,
          direction: "top",
          offset: [0, -10],
          className: "stay-rider-label",
        });
      } catch {
        if (!cancelled) {
          setMapError(true);
        }
      }
    }

    renderMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  if (mapError) {
    return (
      <div className="route-map-error">
        <strong>Map could not load</strong>
        <span>Open Maps to view Zion Elite Residency.</span>
      </div>
    );
  }

  return <div className="stay-real-map" ref={mapRef} />;
}

function TripMap() {
  return (
    <section className="map-section" aria-label="Kodaikanal Trip staying place">
      <div className="stay-card">
        <div>
          <p className="eyebrow">Stay</p>
          <h2>Zion Elite Residency</h2>
        </div>
        <a className="map-link-button" href={STAY_MAP_URL} target="_blank" rel="noreferrer">
          Open in Maps
        </a>
      </div>

      <div className="map-panel">
        <StayMapPreview />
      </div>
    </section>
  );
}

export default TripMap;