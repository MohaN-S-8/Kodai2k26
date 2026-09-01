import { useEffect, useMemo, useState } from "react";
import ActionMenu from "./components/ActionMenu";
import ExpensePanel from "./components/ExpensePanel";
import Header from "./components/Header";
import NamePromptModal from "./components/NamePromptModal";
import Toast from "./components/Toast";
import TripLoader from "./components/TripLoader";
import TripMap from "./components/TripMap";
import TravelRoute from "./components/TravelRoute";
import { BALANCE_COLUMN, PREFERRED_COLUMNS } from "./data/tripConfig";
import { fetchTripSheetData, updateTripPayment } from "./lib/googleSheet";
import { findMemberByName, isNumber } from "./utils/names";
import { getMoneyNumber } from "./utils/money";

function App() {
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState("home");
  const [showIntro, setShowIntro] = useState(true);
  const [isNamePromptOpen, setIsNamePromptOpen] = useState(false);
  const [nameError, setNameError] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);
  const [paymentUpdateError, setPaymentUpdateError] = useState("");
  const [toast, setToast] = useState(null);

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

  function showToast(type, message) {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3200);
  }

  function returnHome() {
    setActiveView("home");
    setSelectedMember(null);
    setNameError("");
  }

  function openExpenseNamePrompt() {
    setNameError("");
    setIsNamePromptOpen(true);
  }

  function applySheetData(data, currentMemberName = selectedMember?.Name) {
    const nextRows = data.rows;
    const nextMemberRows = nextRows.filter((row) => isNumber(row.No) && row.Name);

    setColumns(data.columns);
    setRows(nextRows);

    if (currentMemberName) {
      setSelectedMember(findMemberByName(nextMemberRows, currentMemberName));
    }
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
    const matchedMember = findMemberByName(memberRows, name);

    if (!matchedMember) {
      setNameError("Name not found in the trip sheet. Try the same spelling from the sheet.");
      return;
    }

    setSelectedMember(matchedMember);
    setActiveView("expenses");
    setIsNamePromptOpen(false);
    setNameError("");
  }

  if (showIntro) {
    return <TripLoader onFinish={() => setShowIntro(false)} />;
  }

  return (
    <main className="page-shell">
      <Header
        peopleCount={memberRows.length}
        totalBalance={totalBalance}
        onHome={returnHome}
      />

      {status === "ready" && rows.length > 0 && (
        <>
          <TravelRoute />
          <TripMap />
        </>
      )}

      {status === "ready" && rows.length > 0 && (
        <ActionMenu
          isActive={activeView === "expenses"}
          onOpenExpenses={openExpenseNamePrompt}
        />
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
        <ExpensePanel
          displayColumns={displayColumns}
          memberRows={memberRows}
          selectedMember={selectedMember}
          onClose={returnHome}
          onUpdatePayment={handlePaymentUpdate}
          isUpdatingPayment={isUpdatingPayment}
          paymentUpdateError={paymentUpdateError}
        />
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />

      {isNamePromptOpen && (
        <NamePromptModal
          error={nameError}
          onClose={() => setIsNamePromptOpen(false)}
          onSubmit={handleNameSubmit}
        />
      )}
    </main>
  );
}

export default App;


