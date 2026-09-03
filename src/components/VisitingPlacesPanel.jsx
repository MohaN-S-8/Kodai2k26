import { useEffect, useMemo, useRef, useState } from "react";
import { VISITING_PLACES } from "../data/visitingPlaces";
import { fetchVisitingPlaces, saveVisitingPlaces } from "../lib/visitingPlaces";
import { loadLeaflet } from "../utils/leaflet";

const CUSTOM_PLACES_KEY = "Kodaikanal-custom-visiting-places";
const STORAGE_KEY = "Kodaikanal-visiting-places";
const VISITING_UPDATE_PIN = import.meta.env.VITE_TRIP_UPDATE_PIN || "";
const VISITING_DAY_1_ROUTE_URL = import.meta.env.VITE_VISITING_DAY_1_ROUTE_URL || "https://maps.app.goo.gl/jRa5ooB2pMXLodjPA";
const VISITING_DAY_2_ROUTE_URL = import.meta.env.VITE_VISITING_DAY_2_ROUTE_URL || "https://maps.app.goo.gl/VHZWKhNDmx4wJVKCA";
const VISITING_REFRESH_INTERVAL_MS = Math.max(
  Number(
    import.meta.env.VITE_VISITING_PLACES_REFRESH_INTERVAL_MS ||
      import.meta.env.VITE_SHEET_REFRESH_INTERVAL_MS ||
      15000,
  ),
  5000,
);

const VISITING_ROUTE_DAYS = [
  {
    id: "day-1",
    title: "Day 1",
    subtitle: "Kodaikanal local route",
    mapUrl: VISITING_DAY_1_ROUTE_URL,
    mapCoordinates: [
      [10.2389, 77.4892],
      [10.2358, 77.4929],
      [10.235, 77.4947],
      [10.2202, 77.4672],
      [10.2139, 77.4642],
      [10.231, 77.4759],
      [10.2427, 77.4278],
      [10.2386, 77.466],
      [10.2362, 77.472],
    ],
    placeIds: [
      "kodaikanal-lake",
      "bryant-park",
      "coakers-walk",
      "guna-cave",
      "pillar-rocks",
      "pine-forest",
      "moir-point",
      "solar-observatory-museum",
      "fairy-falls",
    ],
  },
  {
    id: "day-2",
    title: "Day 2",
    subtitle: "Stay to Poomparai route",
    mapUrl: VISITING_DAY_2_ROUTE_URL,
    mapCoordinates: [
      [10.2604, 77.4958],
      [10.244, 77.3648],
      [10.2514, 77.4055],
      [10.273, 77.349],
    ],
    placeIds: [
      "zion-elite-residency",
      "poombarai",
      "poombarai-view-point",
      "perumbakkam-main-road",
    ],
  },
];

function RouteMap({ routeDay }) {
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

        const coordinates = routeDay.routeStops.map((stop) => stop.coordinate).filter(Boolean);
        const map = L.map(mapRef.current, {
          zoomControl: true,
          scrollWheelZoom: false,
        });
        mapInstanceRef.current = map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);

        const bounds = L.latLngBounds(coordinates);

        routeDay.routeStops.forEach((stop, index) => {
          if (!stop.coordinate) {
            return;
          }

          const marker = L.marker(stop.coordinate, {
            icon: L.divIcon({
              className: "place-leaflet-pin",
              html: `<span>${index + 1}</span>`,
              iconSize: [34, 34],
              iconAnchor: [17, 17],
            }),
          }).addTo(map);
          marker.bindTooltip(stop.place.name, {
            permanent: true,
            direction: "top",
            offset: [0, -18],
            className: "place-leaflet-label",
          });
        });

        map.fitBounds(bounds, {
          padding: [34, 34],
          maxZoom: 14,
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
  }, [routeDay]);

  if (mapError) {
    return (
      <div className="route-map-error">
        <strong>Map could not load</strong>
        <span>Use Show on map to open the full route.</span>
      </div>
    );
  }

  return <div className="places-real-map" ref={mapRef} />;
}
function getStoredArray(key) {
  try {
    const value = window.localStorage.getItem(key);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function createPlaceId(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `custom-${slug || "place"}-${Date.now()}`;
}

function normalizePlace(place) {
  return {
    id: place.id,
    name: place.name,
    cost: place.cost || "Under Rs 500",
    note: place.note || "",
    visited: Boolean(place.visited),
    custom: Boolean(place.custom) || String(place.id || "").startsWith("custom-"),
  };
}

function mergeDefaultPlaces(places) {
  const normalizedPlaces = places.map(normalizePlace);
  const placesById = new Map(normalizedPlaces.map((place) => [place.id, place]));
  const defaultIds = new Set(VISITING_PLACES.map((place) => place.id));
  const defaultPlaces = VISITING_PLACES.map((place) => ({
    ...normalizePlace(place),
    visited: Boolean(placesById.get(place.id)?.visited),
  }));
  const customPlaces = normalizedPlaces.filter((place) => place.custom && !defaultIds.has(place.id));

  return [...defaultPlaces, ...customPlaces];
}
function getFallbackPlaces() {
  const visitedIds = getStoredArray(STORAGE_KEY);
  const customPlaces = getStoredArray(CUSTOM_PLACES_KEY).map(normalizePlace);

  return [...VISITING_PLACES, ...customPlaces].map((place) => ({
    ...normalizePlace(place),
    visited: visitedIds.includes(place.id),
  }));
}

function VisitingPlacesPanel({ onClose, onToast }) {
  const [places, setPlaces] = useState(() => getFallbackPlaces());
  const [pin, setPin] = useState("");
  const [editorPin, setEditorPin] = useState("");
  const [isPinUnlocked, setIsPinUnlocked] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingPlaceId, setEditingPlaceId] = useState(null);
  const [placeName, setPlaceName] = useState("");
  const [placeCost, setPlaceCost] = useState("Under Rs 500");
  const [placeNote, setPlaceNote] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPlaces({ silent = false } = {}) {
      try {
        if (!silent) {
          setIsSyncing(true);
        }

        const data = await fetchVisitingPlaces();

        if (!cancelled && Array.isArray(data.places)) {
          setPlaces(mergeDefaultPlaces(data.places));
        }
      } catch (error) {
        if (!cancelled && !silent) {
          onToast("error", error.message || "Visiting places loaded from this browser only");
        }
      } finally {
        if (!cancelled && !silent) {
          setIsSyncing(false);
        }
      }
    }

    loadPlaces();
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") {
        loadPlaces({ silent: true });
      }
    }, VISITING_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, [onToast]);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(places.filter((place) => place.visited).map((place) => place.id)),
    );
    window.localStorage.setItem(
      CUSTOM_PLACES_KEY,
      JSON.stringify(places.filter((place) => place.custom)),
    );
  }, [places]);

  const visitedCount = useMemo(
    () => places.filter((place) => place.visited).length,
    [places]
  );
  const isEditing = Boolean(editingPlaceId);
  const routeGroups = useMemo(() => {
    const placesById = new Map(places.map((place) => [place.id, place]));
    return VISITING_ROUTE_DAYS.map((routeDay) => ({
      ...routeDay,
      routeStops: routeDay.placeIds.map((placeId, index) => ({
        place: placesById.get(placeId),
        coordinate: routeDay.mapCoordinates[index],
      })).filter((stop) => stop.place),
    })).map((routeDay) => ({
      ...routeDay,
      places: routeDay.routeStops.map((stop) => stop.place),
    })).filter((routeDay) => routeDay.places.length > 0);
  }, [places]);
  const groupedPlaceIds = useMemo(
    () => new Set(VISITING_ROUTE_DAYS.flatMap((routeDay) => routeDay.placeIds)),
    [],
  );
  const extraPlaces = useMemo(
    () => places.filter((place) => !groupedPlaceIds.has(place.id)),
    [groupedPlaceIds, places],
  );

  async function syncPlaces(nextPlaces, successMessage) {
    setPlaces(nextPlaces);

    try {
      setIsSyncing(true);
      const data = await saveVisitingPlaces({ places: nextPlaces, pin: editorPin });

      if (Array.isArray(data.places)) {
        setPlaces(mergeDefaultPlaces(data.places));
      }

      onToast("success", successMessage);
    } catch (error) {
      onToast("error", error.message || "Visiting places sync failed");
    } finally {
      setIsSyncing(false);
    }
  }

  function resetPlaceForm() {
    setEditingPlaceId(null);
    setPlaceName("");
    setPlaceCost("Under Rs 500");
    setPlaceNote("");
  }

  function handlePinSubmit(event) {
    event.preventDefault();

    if (pin.trim() !== VISITING_UPDATE_PIN) {
      setIsPinUnlocked(false);
      setEditorPin("");
      onToast("error", "Trip PIN is wrong");
      return;
    }

    setIsPinUnlocked(true);
    setEditorPin(pin.trim());
    setPin("");
    onToast("success", "Visiting places update access unlocked");
  }

  function handleEditPlace(place, event) {
    event.preventDefault();
    event.stopPropagation();

    if (!isPinUnlocked) {
      onToast("error", "Enter Trip PIN to edit places");
      return;
    }

    setEditingPlaceId(place.id);
    setPlaceName(place.name);
    setPlaceCost(place.cost || "Under Rs 500");
    setPlaceNote(place.note || "");
  }

  function handleSavePlace(event) {
    event.preventDefault();

    const name = placeName.trim();
    const cost = placeCost.trim() || "Under Rs 500";
    const note = placeNote.trim() || "Custom stop added by the trip editor.";

    if (!isPinUnlocked) {
      onToast("error", "Enter Trip PIN to save places");
      return;
    }

    if (!name) {
      onToast("error", "Add a place name first");
      return;
    }

    if (places.some((place) => place.id !== editingPlaceId && place.name.toLowerCase() === name.toLowerCase())) {
      onToast("error", `${name} is already in the list`);
      return;
    }

    if (editingPlaceId) {
      const nextPlaces = places.map((place) =>
        place.id === editingPlaceId ? { ...place, name, cost, note } : place,
      );
      resetPlaceForm();
      syncPlaces(nextPlaces, `${name} updated`);
      return;
    }

    const nextPlaces = [
      ...places,
      {
        id: createPlaceId(name),
        name,
        cost,
        note,
        visited: false,
        custom: true,
      },
    ];

    resetPlaceForm();
    syncPlaces(nextPlaces, `${name} added to visiting places`);
  }

  function handleToggle(place) {
    if (!isPinUnlocked) {
      onToast("error", "Enter Trip PIN to update visiting places");
      return;
    }

    const nextPlaces = places.map((currentPlace) =>
      currentPlace.id === place.id
        ? { ...currentPlace, visited: !currentPlace.visited }
        : currentPlace,
    );
    const isVisited = !place.visited;
    syncPlaces(nextPlaces, `${place.name} ${isVisited ? "marked visited" : "opened again"}`);
  }

  function handleDeletePlace(place, event) {
    event.preventDefault();
    event.stopPropagation();

    if (!isPinUnlocked) {
      onToast("error", "Enter Trip PIN to delete places");
      return;
    }

    if (editingPlaceId === place.id) {
      resetPlaceForm();
    }

    syncPlaces(
      places.filter((currentPlace) => currentPlace.id !== place.id),
      `${place.name} deleted from visiting places`,
    );
  }

  return (
    <section className="visiting-panel" aria-label="Visiting places checklist">
      <div className="table-heading">
        <div>
          <p className="eyebrow">Visiting places</p>
          <h2>Kodaikanal stop checklist</h2>
        </div>
        <div className="table-actions">
          <span>
            {isSyncing
              ? "Syncing..."
              : `${visitedCount} / ${places.length} done`}
          </span>
          <button
            className="close-panel-button"
            type="button"
            aria-label="Close visiting places"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

      <div className="visiting-access-card">
        <div>
          <strong>
            {isPinUnlocked ? "Update access enabled" : "View only"}
          </strong>
          <small>
            {isPinUnlocked
              ? "Changes sync to the Visiting Places sheet"
              : "Enter Trip PIN to update the checklist"}
          </small>
        </div>
        <span>{isPinUnlocked ? "Editor" : "View only"}</span>
      </div>

      {!isPinUnlocked && (
        <form className="visiting-pin-form" onSubmit={handlePinSubmit}>
          <label>
            Trip PIN
            <input
              type="password"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder="Enter Trip PIN"
            />
          </label>
          <button type="submit" disabled={!pin.trim()}>
            Unlock updates
          </button>
        </form>
      )}

      {isPinUnlocked && (
        <form className="add-place-form" onSubmit={handleSavePlace}>
          <label>
            Place name
            <input
              type="text"
              value={placeName}
              onChange={(event) => setPlaceName(event.target.value)}
              placeholder="Example: Pine Forest"
            />
          </label>
          <label>
            Cost
            <input
              type="text"
              value={placeCost}
              onChange={(event) => setPlaceCost(event.target.value)}
              placeholder="Under Rs 500"
            />
          </label>
          <label>
            Note
            <input
              type="text"
              value={placeNote}
              onChange={(event) => setPlaceNote(event.target.value)}
              placeholder="Short plan note"
            />
          </label>
          <button type="submit" disabled={!placeName.trim() || isSyncing}>
            {isEditing ? "Save place" : "Add place"}
          </button>
          {isEditing && (
            <button className="cancel-edit-button" type="button" onClick={resetPlaceForm}>
              Cancel
            </button>
          )}
        </form>
      )}

      <div className="visiting-route-list">
        {routeGroups.map((routeDay) => (
          <section className="visiting-route-group" key={routeDay.id}>
            <div className="visiting-route-heading">
              <div>
                <p>{routeDay.title}</p>
                <strong>{routeDay.subtitle}</strong>
              </div>
              <a
                className="map-route-button"
                href={routeDay.mapUrl}
                target="_blank"
                rel="noreferrer"
              >
                Show on map
              </a>
            </div>
            <div className="visiting-map-panel" aria-label={`${routeDay.title} places map`}>
              <RouteMap routeDay={routeDay} />
            </div>
            <div className="visiting-grid">
              {routeDay.places.map((place) => (
          <label
            className={`visiting-place ${place.visited ? "is-visited" : ""} ${!isPinUnlocked ? "is-locked" : ""}`}
            key={place.id}
          >
            <input
              type="checkbox"
              checked={place.visited}
              readOnly={!isPinUnlocked}
              onChange={() => handleToggle(place)}
            />
            <span className="visit-check" aria-hidden="true" />
            <span className="visit-copy">
              <strong>{place.name}</strong>
              <em>{place.cost}</em>
              <small>{place.note}</small>
            </span>
            {isPinUnlocked && (
              <span className="place-actions">
                <button
                  className="edit-place-button"
                  type="button"
                  aria-label={`Edit ${place.name}`}
                  onClick={(event) => handleEditPlace(place, event)}
                >
                  Edit
                </button>
                <button
                  className="delete-place-button"
                  type="button"
                  aria-label={`Delete ${place.name}`}
                  onClick={(event) => handleDeletePlace(place, event)}
                >
                  Delete
                </button>
              </span>
            )}
          </label>
              ))}
            </div>
          </section>
        ))}

        {extraPlaces.length > 0 && (
          <section className="visiting-route-group">
            <div className="visiting-route-heading">
              <div>
                <p>Extra stops</p>
                <strong>Added by trip editor</strong>
              </div>
            </div>
            <div className="visiting-grid">
              {extraPlaces.map((place) => (
          <label
            className={`visiting-place ${place.visited ? "is-visited" : ""} ${!isPinUnlocked ? "is-locked" : ""}`}
            key={place.id}
          >
            <input
              type="checkbox"
              checked={place.visited}
              readOnly={!isPinUnlocked}
              onChange={() => handleToggle(place)}
            />
            <span className="visit-check" aria-hidden="true" />
            <span className="visit-copy">
              <strong>{place.name}</strong>
              <em>{place.cost}</em>
              <small>{place.note}</small>
            </span>
            {isPinUnlocked && (
              <span className="place-actions">
                <button
                  className="edit-place-button"
                  type="button"
                  aria-label={`Edit ${place.name}`}
                  onClick={(event) => handleEditPlace(place, event)}
                >
                  Edit
                </button>
                <button
                  className="delete-place-button"
                  type="button"
                  aria-label={`Delete ${place.name}`}
                  onClick={(event) => handleDeletePlace(place, event)}
                >
                  Delete
                </button>
              </span>
            )}
          </label>
              ))}
            </div>
          </section>
        )}
      </div>
    </section>
  );
}

export default VisitingPlacesPanel;