const STAY_MAP_URL = "https://maps.app.goo.gl/7YxBZBgb9ALJRVsr9";
const STAY_EMBED_URL =
  "https://www.google.com/maps?q=Zion%20Elite%20Residency%2C%20Kodaikanal&output=embed";

function TripMap() {
  return (
    <section className="map-section" aria-label="Kodai trip staying place">
      <div className="stay-card">
        <div>
          <p className="eyebrow">Staying place</p>
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
