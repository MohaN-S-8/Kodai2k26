function TripMap() {
  return (
    <section className="map-panel" aria-label="Kodai trip map">
      <iframe
        title="Kodaikanal trip map"
        src="https://www.google.com/maps?q=Kodaikanal,Tamil%20Nadu&output=embed"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </section>
  );
}

export default TripMap;
