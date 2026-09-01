import { useEffect, useMemo, useRef, useState } from "react";
import { fetchTripSheetData } from "./lib/googleSheet";

const COMMON_COSTS = [
  {
    label: "Van Total",
    value: "46000",
    note: "Common trip van amount",
  },
  {
    label: "Room Total",
    value: "11000",
    note: "Common stay amount",
  },
  {
    label: "Camera Total",
    value: "1950",
    note: "Already added to whoever pays it",
  },
  {
    label: "Food",
    value: "1500",
    note: "Per person for 2 days",
  },
  {
    label: "Entry Fee",
    value: "500",
    note: "Per person",
  },
];

const COLUMN_LABELS = {
  No: "No",
  Name: "Name",
  "Van Share": "Van Share",
  "Room Share": "Room Share",
  "ROOM GIVEN": "Room Given",
  "van given": "Van Given",
  "VAN BALANCE": "Van Balance",
  "ROOM bALANCE": "Room Balance",
  "Balance [Travel &Stay]": "Travel & Stay Balance",
  Total: "Total",
};

const MONEY_COLUMNS = new Set([
  "Van Share",
  "Room Share",
  "ROOM GIVEN",
  "van given",
  "VAN BALANCE",
  "ROOM bALANCE",
  "Balance [Travel &Stay]",
  "Total",
]);

function isNumber(value) {
  return /^\d+$/.test(String(value || "").trim());
}

function formatMoney(value) {
  const number = Number(String(value || "").replace(/,/g, ""));

  if (!Number.isFinite(number)) {
    return value || "-";
  }

  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(number);
}

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

  async function startTrip() {
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
        <button className="start-trip-button" type="button" onClick={startTrip}>
          Start Trip
        </button>
      )}
    </section>
  );
}
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

function App() {
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState("home");
  const [showIntro, setShowIntro] = useState(true);

useEffect(() => {
    let cancelled = false;

    async function loadSheet() {
      try {
        setStatus("loading");
        const data = await fetchTripSheetData();

        if (!cancelled) {
          setColumns(data.columns);
          setRows(data.rows);
          setStatus("ready");
        }
      } catch (sheetError) {
        if (!cancelled) {
          setError(sheetError.message);
          setStatus("error");
        }
      }
    }

    loadSheet();

    return () => {
      cancelled = true;
    };
  }, []);

  const memberRows = useMemo(
    () => rows.filter((row) => isNumber(row.No) && row.Name),
    [rows]
  );

  const displayColumns = useMemo(() => {
    const preferredColumns = [
      "No",
      "Name",
      "Van Share",
      "Room Share",
      "ROOM GIVEN",
      "van given",
      "VAN BALANCE",
      "ROOM bALANCE",
      "Balance [Travel &Stay]",
      "Total",
    ];

    const availablePreferred = preferredColumns.filter((column) =>
      columns.includes(column)
    );

    return availablePreferred.length > 0 ? availablePreferred : columns;
  }, [columns]);

  const totalBalance = useMemo(
    () =>
      memberRows.reduce(
        (total, row) =>
          total +
          Number(String(row["Balance [Travel &Stay]"] || 0).replace(/,/g, "")),
        0
      ),
    [memberRows]
  );

  if (showIntro) {
    return <TripLoader onFinish={() => setShowIntro(false)} />;
  }

  return (
    <main className="page-shell">
      <section className="top-bar">
        <div>
          <p className="eyebrow">Kodai trip sheet</p>
          <h1>Trip Balance Table</h1>
        </div>
        <div className="stats">
          <span>{memberRows.length} friends</span>
          <span>Rs {formatMoney(totalBalance)} balance</span>
          <span>{displayColumns.length} columns</span>
        </div>
      </section>

      {status === "ready" && rows.length > 0 && <TripMap />}

      {status === "ready" && rows.length > 0 && (
        <section className="action-strip" aria-label="Trip actions">
          <div>
            <p className="eyebrow">Choose your chaos</p>
            <h2>
              {activeView === "expenses"
                ? "Overall Cost & Expense"
                : "Trip Control Panel"}
            </h2>
          </div>

          <div className="menu-wrap">
            <button
              aria-expanded={isMenuOpen}
              aria-haspopup="menu"
              aria-label="Open trip options"
              className="meatball-button"
              onClick={() => setIsMenuOpen((open) => !open)}
              type="button"
            >
              <span />
              <span />
              <span />
            </button>

            {isMenuOpen && (
              <div className="options-menu" role="menu">
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setActiveView("expenses");
                    setIsMenuOpen(false);
                  }}
                >
                  Overall Cost & Expense
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {status === "loading" && (
        <section className="state-panel">
          <div className="loader" aria-hidden="true" />
          <p>Fetching the trip secrets from Google Sheets...</p>
        </section>
      )}

      {status === "error" && (
        <section className="state-panel error">
          <h2>Sheet could not load</h2>
          <p>{error}</p>
        </section>
      )}

      {status === "ready" && rows.length === 0 && (
        <section className="state-panel">
          <p>The sheet loaded, but there are no data rows yet.</p>
        </section>
      )}

{status === "ready" && rows.length > 0 && activeView === "expenses" && (
        <>
          <section className="summary-grid" aria-label="Common trip costs">
            {COMMON_COSTS.map((cost) => (
              <article className="summary-card" key={cost.label}>
                <p>{cost.label}</p>
                <strong>Rs {cost.value}</strong>
                <span>{cost.note}</span>
              </article>
            ))}
          </section>

          <section className="table-panel" aria-label="Google Sheet data">
            <div className="table-heading">
              <div>
                <p className="eyebrow">Live from Google Sheet</p>
                <h2>Friends Payment Status</h2>
              </div>
              <span>{memberRows.length} people listed</span>
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {displayColumns.map((column) => (
                      <th key={column}>{COLUMN_LABELS[column] || column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {memberRows.map((row, rowIndex) => (
                    <tr key={`${row.No}-${row.Name}-${rowIndex}`}>
                      {displayColumns.map((column) => (
                        <td
                          className={MONEY_COLUMNS.has(column) ? "money" : ""}
                          key={column}
                        >
                          {MONEY_COLUMNS.has(column)
                            ? formatMoney(row[column])
                            : row[column] || "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

export default App;




