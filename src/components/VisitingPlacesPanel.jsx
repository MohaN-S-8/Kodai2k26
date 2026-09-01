import { useEffect, useMemo, useState } from "react";
import { VISITING_PLACES } from "../data/visitingPlaces";

const STORAGE_KEY = "kodai-visiting-places";
const VISITING_UPDATE_PIN = import.meta.env.VITE_TRIP_UPDATE_PIN || "2026";

function getStoredVisitedPlaces() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function VisitingPlacesPanel({ onClose, onToast }) {
  const [visitedIds, setVisitedIds] = useState(() => getStoredVisitedPlaces());
  const [pin, setPin] = useState("");
  const [isPinUnlocked, setIsPinUnlocked] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visitedIds));
  }, [visitedIds]);

  const visitedCount = useMemo(
    () => VISITING_PLACES.filter((place) => visitedIds.includes(place.id)).length,
    [visitedIds]
  );

  function handlePinSubmit(event) {
    event.preventDefault();

    if (pin.trim() !== VISITING_UPDATE_PIN) {
      setIsPinUnlocked(false);
      onToast("error", "Trip PIN is wrong");
      return;
    }

    setIsPinUnlocked(true);
    setPin("");
    onToast("success", "Visiting places update access unlocked");
  }

  function handleToggle(place) {
    if (!isPinUnlocked) {
      onToast("error", "Enter Trip PIN to update visiting places");
      return;
    }

    setVisitedIds((currentIds) => {
      const isVisited = currentIds.includes(place.id);
      const nextIds = isVisited
        ? currentIds.filter((id) => id !== place.id)
        : [...currentIds, place.id];
      onToast("success", `${place.name} ${isVisited ? "opened again" : "marked visited"}`);
      return nextIds;
    });
  }

  return (
    <section className="visiting-panel" aria-label="Visiting places checklist">
      <div className="table-heading">
        <div>
          <p className="eyebrow">Visiting places</p>
          <h2>Kodai stop checklist</h2>
        </div>
        <div className="table-actions">
          <span>{visitedCount} / {VISITING_PLACES.length} done</span>
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
          <small>{isPinUnlocked ? "You can tick and untick places now" : "Enter Trip PIN to update the checklist"}</small>
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

      <div className="visiting-grid">
        {VISITING_PLACES.map((place) => {
          const isVisited = visitedIds.includes(place.id);

          return (
            <label
              className={`visiting-place ${isVisited ? "is-visited" : ""} ${!isPinUnlocked ? "is-locked" : ""}`}
              key={place.id}
            >
              <input
                type="checkbox"
                checked={isVisited}
                readOnly={!isPinUnlocked}
                onChange={() => handleToggle(place)}
              />
              <span className="visit-check" aria-hidden="true" />
              <span className="visit-copy">
                <strong>{place.name}</strong>
                <em>{place.cost}</em>
                <small>{place.note}</small>
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

export default VisitingPlacesPanel;
