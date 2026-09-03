import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ActionMenu from "./components/ActionMenu";
import ExpensePanel from "./components/ExpensePanel";
import ExpenseSpentPanel from "./components/ExpenseSpentPanel";
import FoodExpensePanel from "./components/FoodExpensePanel";
import Header from "./components/Header";
import Toast from "./components/Toast";
import TripLoader from "./components/TripLoader";
import TripMap from "./components/TripMap";
import TravelRoute from "./components/TravelRoute";
import VisitingPlacesPanel from "./components/VisitingPlacesPanel";
import { BALANCE_COLUMN, PREFERRED_COLUMNS } from "./data/tripConfig";
import { fetchTripSheetData, updateTripPayment } from "./lib/googleSheet";
import { findMemberByName, isNumber } from "./utils/names";
import { getMoneyNumber } from "./utils/money";

const SHEET_REFRESH_INTERVAL_MS = Math.max(
  Number(import.meta.env.VITE_SHEET_REFRESH_INTERVAL_MS || 15000),
  5000,
);
function App() {
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState("home");
  const [showIntro, setShowIntro] = useState(true);
  const [nameError, setNameError] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);
  const [paymentUpdateError, setPaymentUpdateError] = useState("");
  const [paymentManagerPin, setPaymentManagerPin] = useState(() => sessionStorage.getItem("kodai-payment-manager-pin") || "");
  const [toast, setToast] = useState(null);
  const selectedMemberNameRef = useRef("");

  const applySheetData = useCallback((data, currentMemberName = selectedMemberNameRef.current) => {
    const nextRows = data.rows;
    const nextMemberRows = nextRows.filter((row) => isNumber(row.No) && row.Name);

    setColumns(data.columns);
    setRows(nextRows);

    if (currentMemberName) {
      setSelectedMember(findMemberByName(nextMemberRows, currentMemberName));
    }
  }, []);

  useEffect(() => {
    selectedMemberNameRef.current = selectedMember?.Name || "";
  }, [selectedMember]);

  useEffect(() => {
    let cancelled = false;

    async function loadSheet({ silent = false } = {}) {
      try {
        if (!silent) {
          setStatus("loading");
        }

        const data = await fetchTripSheetData();

        if (!cancelled) {
          applySheetData(data);
          setError("");
          setStatus("ready");
        }
      } catch (sheetError) {
        if (!cancelled && !silent) {
          setError(sheetError.message);
          setStatus("error");
        }
      }
    }

    loadSheet();
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") {
        loadSheet({ silent: true });
      }
    }, SHEET_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, [applySheetData]);

  const memberRows = useMemo(
    () =>
      rows
        .filter((row) => isNumber(row.No) && row.Name)
        .sort((firstRow, secondRow) =>
          firstRow.Name.localeCompare(secondRow.Name, undefined, {
            sensitivity: "base",
          })
        ),
    [rows]
  );

  const displayColumns = useMemo(() => {
    const availablePreferred = PREFERRED_COLUMNS.filter((column) =>
      columns.includes(column)
    );

    return availablePreferred.length > 0 ? availablePreferred : columns;
  }, [columns]);

  const totalBalance = useMemo(
    () =>
      memberRows.reduce(
        (total, row) => total + getMoneyNumber(row[BALANCE_COLUMN]),
        0
      ),
    [memberRows]
  );
  const promptNames = useMemo(
    () => memberRows.map((row) => row.Name).filter(Boolean),
    [memberRows]
  );
  const isPaymentManagerUnlocked = Boolean(paymentManagerPin);

  const unlockPaymentManager = useCallback((pin) => {
    setPaymentManagerPin(pin);
    sessionStorage.setItem("kodai-payment-manager-pin", pin);
  }, []);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  function returnHome() {
    setActiveView("home");
    setSelectedMember(null);
    setNameError("");
  }

  function openExpenseNamePrompt() {
    setNameError("");
    setPaymentUpdateError("");
    setSelectedMember(null);
    setActiveView("expenses");
  }

  function openVisitingPlaces() {
    setActiveView("visiting");
    setSelectedMember(null);
    setNameError("");
  }

  function openFoodExpenses() {
    setActiveView("food");
    setSelectedMember(null);
    setNameError("");
  }

  function openSpentExpenses() {
    setActiveView("spent");
    setSelectedMember(null);
    setNameError("");
  }

  async function handlePaymentUpdate({ name, totalGiven, pin }) {
    const targetName = name || selectedMember?.Name;

    if (!targetName) {
      return;
    }

    try {
      setIsUpdatingPayment(true);
      setPaymentUpdateError("");
      const data = await updateTripPayment({
        name: targetName,
        totalGiven,
        pin,
      });
      applySheetData(data, selectedMember?.Name);
      showToast("success", `${targetName} payment updated successfully`);
    } catch (updateError) {
      setPaymentUpdateError(updateError.message);
      showToast("error", updateError.message || "Payment update failed");
    } finally {
      setIsUpdatingPayment(false);
    }
  }

  function handleNameSubmit(name) {
    const trimmedName = name.trim();
    const matchedMember = findMemberByName(memberRows, trimmedName);

    if (!matchedMember) {
      setNameError("Name not found in the trip sheet. Try the same spelling from the sheet.");
      return;
    }

    setSelectedMember(matchedMember);
    setActiveView("expenses");
  }

  if (showIntro) {
    return <TripLoader onFinish={() => setShowIntro(false)} />;
  }

  return (
    <main className="app-shell">
      <section className="trip-bg-band trip-bg-route">
        <div className="page-shell">
          <Header
            peopleCount={memberRows.length}
            totalBalance={totalBalance}
            onHome={returnHome}
          />

          {status === "ready" && rows.length > 0 && <TravelRoute />}

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
        </div>
      </section>

      {status === "ready" && rows.length > 0 && (
        <section className="trip-bg-band trip-bg-stay">
          <div className="page-shell">
            <TripMap />
          </div>
        </section>
      )}

      {status === "ready" && rows.length > 0 && (
        <section className="trip-bg-band trip-bg-details">
          <div className="page-shell">
            <ActionMenu
              activeView={activeView}
              onOpenExpenses={openExpenseNamePrompt}
              onOpenVisiting={openVisitingPlaces}
              onOpenFood={openFoodExpenses}
              onOpenSpent={openSpentExpenses}
            />

            {activeView === "expenses" && (
              <ExpensePanel
                displayColumns={displayColumns}
                memberRows={memberRows}
                nameError={nameError}
                names={promptNames}
                selectedMember={selectedMember}
                onClose={returnHome}
                onSelectMember={handleNameSubmit}
                onUpdatePayment={handlePaymentUpdate}
                isUpdatingPayment={isUpdatingPayment}
                isPaymentManagerUnlocked={isPaymentManagerUnlocked}
                paymentManagerPin={paymentManagerPin}
                onPaymentManagerUnlock={unlockPaymentManager}
                paymentUpdateError={paymentUpdateError}
              />
            )}

            {activeView === "visiting" && (
              <VisitingPlacesPanel
                onClose={returnHome}
                onToast={showToast}
              />
            )}


            {activeView === "spent" && (
              <ExpenseSpentPanel
                onClose={returnHome}
                onToast={showToast}
              />
            )}
            {activeView === "food" && (
              <FoodExpensePanel
                memberRows={memberRows}
                onClose={returnHome}
                onToast={showToast}
              />
            )}
          </div>
        </section>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
</main>
  );
}

export default App;
