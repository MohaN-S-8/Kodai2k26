const STAY_MAP_URL = import.meta.env.VITE_STAY_MAP_URL || "";
const STAY_EMBED_URL = import.meta.env.VITE_STAY_EMBED_URL || "";

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
        <iframe
          title="Zion Elite Residency map"
          src={STAY_EMBED_URL}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </section>
  );
}

export default TripMap;


