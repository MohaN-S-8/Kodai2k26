import { useEffect, useRef, useState } from "react";

function TripLoader({ onFinish }) {
  const audioRef = useRef(null);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (!hasStarted) {
      return undefined;
    }

    const timer = window.setTimeout(onFinish, 6500);

    return () => window.clearTimeout(timer);
  }, [hasStarted, onFinish]);

  async function startTour() {
    const audio = audioRef.current;

    setHasStarted(true);

    if (!audio) {
      return;
    }

    audio.volume = 0.75;
    audio.currentTime = 0;

    try {
      await audio.play();
    } catch {
      // The animation still runs if a browser or device blocks audio.
    }
  }

  return (
    <section
      className={`intro-loader ${hasStarted ? "is-started" : ""}`}
      aria-label="Trip loading screen"
    >
      <audio ref={audioRef} src="/sounds/loading.ogg" preload="auto" />
      <div className="road-line" />
      <div className="rider-track">
        <div className="rider-pack">
          <img src="/images/trip-rider.png" alt="Bike rider loading" />
          <p>Tour na enaku nee than vathiyare...</p>
        </div>
      </div>

      {!hasStarted && (
        <button className="start-trip-button" type="button" onClick={startTour}>
          Start Tour
        </button>
      )}
    </section>
  );
}

export default TripLoader;
