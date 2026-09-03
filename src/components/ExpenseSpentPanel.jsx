import { useEffect, useMemo, useState } from "react";
import { addSpentExpense, fetchSpentExpenses } from "../lib/spentExpenses";
import { formatMoney } from "../utils/money";

const SPENT_STORAGE_KEY = "Kodaikanal-spent-expenses";
const SPENT_PIN_STORAGE_KEY = "kodai-spent-expense-pin";
const SPENT_UPDATE_PIN = import.meta.env.VITE_TRIP_UPDATE_PIN || "";
const SPENT_REFRESH_INTERVAL_MS = Math.max(
  Number(
    import.meta.env.VITE_SPENT_EXPENSES_REFRESH_INTERVAL_MS ||
      import.meta.env.VITE_SHEET_REFRESH_INTERVAL_MS ||
      15000,
  ),
  5000,
);

function normalizeExpense(expense) {
  const amount = Number(String(expense.amount || 0).replace(/,/g, ""));

  return {
    id: String(expense.id || `spent-${Date.now()}`).trim(),
    createdAt: String(expense.createdAt || new Date().toISOString()).trim(),
    amount: Number.isFinite(amount) ? amount : 0,
    note: String(expense.note || "").trim(),
  };
}

function getStoredExpenses() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SPENT_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeExpense).filter((expense) => expense.amount > 0 && expense.note) : [];
  } catch {
    return [];
  }
}

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ExpenseSpentPanel({ memberRows = [], onClose, onToast }) {
  const [expenses, setExpenses] = useState(() => getStoredExpenses());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
    const [splitCount, setSplitCount] = useState("");
const [pin, setPin] = useState("");
  const [editorPin, setEditorPin] = useState(() => sessionStorage.getItem(SPENT_PIN_STORAGE_KEY) || "");
  const [isSyncing, setIsSyncing] = useState(false);

  const isUnlocked = Boolean(editorPin);
  const totalSpent = useMemo(
    () => expenses.reduce((total, expense) => total + expense.amount, 0),
    [expenses],
  );
  const sheetPeopleCount = memberRows.length || 1;
  const splitPeopleCount = Math.max(Number(splitCount || sheetPeopleCount) || sheetPeopleCount, 1);
  const totalPerHead = Math.ceil(totalSpent / splitPeopleCount);

  useEffect(() => {
    if (!splitCount && sheetPeopleCount > 0) {
      setSplitCount(String(sheetPeopleCount));
    }
  }, [sheetPeopleCount, splitCount]);

  useEffect(() => {
    let cancelled = false;

    async function loadExpenses({ silent = false } = {}) {
      try {
        if (!silent) {
          setIsSyncing(true);
        }

        const data = await fetchSpentExpenses();

        if (!cancelled && Array.isArray(data.expenses)) {
          const nextExpenses = data.expenses.map(normalizeExpense).filter((expense) => expense.amount > 0 && expense.note);
          setExpenses(nextExpenses);
        }
      } catch (error) {
        if (!cancelled && !silent) {
          onToast("error", error.message || "Spent expenses loaded from this browser only");
        }
      } finally {
        if (!cancelled && !silent) {
          setIsSyncing(false);
        }
      }
    }

    loadExpenses();
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") {
        loadExpenses({ silent: true });
      }
    }, SPENT_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, [onToast]);

  useEffect(() => {
    window.localStorage.setItem(SPENT_STORAGE_KEY, JSON.stringify(expenses));
  }, [expenses]);

  function handlePinSubmit(event) {
    event.preventDefault();

    if (pin.trim() !== SPENT_UPDATE_PIN) {
      setEditorPin("");
      sessionStorage.removeItem(SPENT_PIN_STORAGE_KEY);
      onToast("error", "Trip PIN is wrong");
      return;
    }

    setEditorPin(pin.trim());
    sessionStorage.setItem(SPENT_PIN_STORAGE_KEY, pin.trim());
    setPin("");
    onToast("success", "Expense spent update access unlocked");
  }

  async function handleAddExpense(event) {
    event.preventDefault();

    if (!isUnlocked) {
      onToast("error", "Enter Trip PIN to add spent expenses");
      return;
    }

    const nextExpense = normalizeExpense({
      id: `spent-${Date.now()}`,
      createdAt: new Date().toISOString(),
      amount,
      note,
    });

    if (nextExpense.amount <= 0) {
      onToast("error", "Enter a valid spent amount");
      return;
    }

    if (!nextExpense.note) {
      onToast("error", "Add a note for why we spent it");
      return;
    }

    setExpenses((currentExpenses) => [nextExpense, ...currentExpenses]);

    try {
      setIsSyncing(true);
      const data = await addSpentExpense({ expense: nextExpense, pin: editorPin });

      if (Array.isArray(data.expenses)) {
        setExpenses(data.expenses.map(normalizeExpense).filter((expense) => expense.amount > 0 && expense.note));
      }

      setAmount("");
      setNote("");
      onToast("success", "Spent expense added");
    } catch (error) {
      onToast("error", error.message || "Spent expense sync failed");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <section className="spent-panel" aria-label="Expense spent">
      <div className="table-heading">
        <div>
          <p className="eyebrow">Expense spent</p>
          <h2>Trip spending log</h2>
        </div>
        <div className="table-actions">
          <span>{sheetPeopleCount} people from sheet | Rs {formatMoney(totalPerHead)} per head</span>
          <button className="close-panel-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>


      <div className="spent-split-card">
        <div>
          <h3>Split people</h3>
          <p>Default comes from the payment sheet people count.</p>
        </div>
        <input
          type="number"
          min="1"
          step="1"
          value={splitCount}
          onChange={(event) => setSplitCount(event.target.value)}
          placeholder={`${sheetPeopleCount} people`}
          aria-label="People count for per-head split"
        />
      </div>
      <div className="spent-access-card">
        <div>
          <h3>{isUnlocked ? "Kalai editor unlocked" : "View only"}</h3>
          <p>{isUnlocked ? "Add amount and note without entering Trip PIN again." : "Enter Trip PIN once to add spent expenses."}</p>
        </div>
        <span>{isUnlocked ? "Unlocked" : "View only"}</span>
      </div>

      {!isUnlocked && (
        <form className="spent-pin-form" onSubmit={handlePinSubmit}>
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

      {isUnlocked && (
        <form className="spent-entry-form" onSubmit={handleAddExpense}>
          <label>
            Amount
            <input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Amount spent"
            />
          </label>
          <label>
            Note
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Why we spent this"
            />
          </label>
          <button type="submit" disabled={isSyncing || !amount || !note.trim()}>
            {isSyncing ? "Saving..." : "Add spent"}
          </button>
        </form>
      )}

      <div className="spent-list" aria-live="polite">
        {expenses.length === 0 ? (
          <p className="spent-empty">No spent expenses added yet.</p>
        ) : (
          expenses.map((expense) => (
            <article className="spent-item" key={expense.id}>
              <div>
                <h3>{expense.note}</h3>
                <p>{formatDate(expense.createdAt)}</p>
              </div>
              <div className="spent-amount-stack">
                <strong>Rs {formatMoney(Math.ceil(expense.amount / splitPeopleCount))} per head</strong>
                <span>Total Rs {formatMoney(expense.amount)} split by {splitPeopleCount} people</span>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export default ExpenseSpentPanel;
