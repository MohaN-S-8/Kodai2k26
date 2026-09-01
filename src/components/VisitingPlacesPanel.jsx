import { useEffect, useMemo, useState } from "react";
import { VISITING_PLACES } from "../data/visitingPlaces";
import { fetchVisitingPlaces, saveVisitingPlaces } from "../lib/visitingPlaces";

const CUSTOM_PLACES_KEY = "kodai-custom-visiting-places";
const STORAGE_KEY = "kodai-visiting-places";
const VISITING_UPDATE_PIN = import.meta.env.VITE_TRIP_UPDATE_PIN || "";

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
  const [placeName, setPlaceName] = useState("");
  const [placeCost, setPlaceCost] = useState("Under Rs 500");
  const [placeNote, setPlaceNote] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPlaces() {
      try {
        setIsSyncing(true);
        const data = await fetchVisitingPlaces();

        if (!cancelled && Array.isArray(data.places)) {
          setPlaces(data.places.map(normalizePlace));
        }
      } catch (error) {
        if (!cancelled) {
          onToast("error", error.message || "Visiting places loaded from this browser only");
        }
      } finally {
        if (!cancelled) {
          setIsSyncing(false);
        }
      }
    }

    loadPlaces();

    return () => {
      cancelled = true;
    };
  }, []);

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

  async function syncPlaces(nextPlaces, successMessage) {
    setPlaces(nextPlaces);

    try {
      setIsSyncing(true);
      const data = await saveVisitingPlaces({ places: nextPlaces, pin: editorPin });

      if (Array.isArray(data.places)) {
        setPlaces(data.places.map(normalizePlace));
      }

      onToast("success", successMessage);
    } catch (error) {
      onToast("error", error.message || "Visiting places sync failed");
    } finally {
      setIsSyncing(false);
    }
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

  function handleAddPlace(event) {
    event.preventDefault();

    const name = placeName.trim();
    const cost = placeCost.trim() || "Under Rs 500";
    const note = placeNote.trim() || "Custom stop added by the trip editor.";

    if (!isPinUnlocked) {
      onToast("error", "Enter Trip PIN to add places");
      return;
    }

    if (!name) {
      onToast("error", "Add a place name first");
      return;
    }

    if (places.some((place) => place.name.toLowerCase() === name.toLowerCase())) {
      onToast("error", `${name} is already in the list`);
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

    setPlaceName("");
    setPlaceCost("Under Rs 500");
    setPlaceNote("");
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

    if (!place.custom) {
      onToast("error", "Default places cannot be deleted");
      return;
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
          <h2>Kodai stop checklist</h2>
        </div>
        <div className="table-actions">
          <span>{isSyncing ? "Syncing..." : `${visitedCount} / ${places.length} done`}</span>
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
          <strong>{isPinUnlocked ? "Update access enabled" : "View only"}</strong>
          <small>{isPinUnlocked ? "Changes sync to the Visiting Places sheet" : "Enter Trip PIN to update the checklist"}</small>
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
        <form className="add-place-form" onSubmit={handleAddPlace}>
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
            Add place
          </button>
        </form>
      )}

      <div className="visiting-grid">
        {places.map((place) => (
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
            {isPinUnlocked && place.custom && (
              <button
                className="delete-place-button"
                type="button"
                aria-label={`Delete ${place.name}`}
                onClick={(event) => handleDeletePlace(place, event)}
              >
                Delete
              </button>
            )}
          </label>
        ))}
      </div>
    </section>
  );
}

export default VisitingPlacesPanel;


