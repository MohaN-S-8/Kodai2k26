const ROUTE_MAP_URL = import.meta.env.VITE_ROUTE_MAP_URL || "";

function TravelRoute() {
  return (
    <section className="route-panel" aria-label="Travel route">
      <div className="route-heading">
        <div>
          <p className="eyebrow">Travel route</p>
          <h2>Chennai to Kodaikanal to Poomparai</h2>
        </div>
        <a
          className="map-link-button"
          href={ROUTE_MAP_URL}
          target="_blank"
          rel="noreferrer"
        >
          Open Route
        </a>
      </div>

      <div
        className="route-preview"
        aria-label="Chennai to Kodaikanal to Poomparai route preview"
      >
        <div className="route-point route-start">
          <span>Start</span>
          <strong>Chennai</strong>
        </div>
        <div className="route-line" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="route-point route-mid">
          <span>Reach</span>
          <strong>Kodaikanal</strong>
        </div>
        <div className="route-line" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="route-point route-end">
          <span>Next</span>
          <strong>Poomparai</strong>
        </div>
      </div>

      <div className="route-road" aria-hidden="true">
        <div className="route-dashes" />
        <div className="route-rider-pack">
          <img
            className="route-rider"
            src="/images/trip-rider.png"
            alt=""
            loading="lazy"
            decoding="async"
          />
          <p>Nee vaa vathiyare namma cycle la tour povom..</p>
          <img
            className="route-van"
            src="/images/route-van.svg"
            alt=""
            loading="lazy"
            decoding="async"
          />
          <img
            className="route-aapa"
            src="/images/aapa.png"
            alt=""
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    </section>
  );
}

export default TravelRoute;