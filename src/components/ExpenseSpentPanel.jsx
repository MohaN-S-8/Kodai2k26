import { useEffect, useMemo, useState } from "react";
import { addSpentExpense, fetchSpentExpenses, saveSpentExpenses } from "../lib/spentExpenses";
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

function getPositiveNumber(value, fallback = 0) {
  const number = Number(String(value || fallback).replace(/,/g, ""));
  return Number.isFinite(number) ? number : fallback;
}

function normalizeExpense(expense, defaultSplitPeople = 1) {
  const amount = getPositiveNumber(expense.amount, 0);
  const splitPeople = getPositiveNumber(expense.splitPeople, defaultSplitPeople);

  return {
    id: String(expense.id || `spent-${Date.now()}`).trim(),
    createdAt: String(expense.createdAt || new Date().toISOString()).trim(),
    amount: amount > 0 ? amount : 0,
    note: String(expense.note || "").trim(),
    splitPeople: splitPeople > 0 ? Math.ceil(splitPeople) : Math.max(defaultSplitPeople, 1),
  };
}

function getStoredExpenses() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SPENT_STORAGE_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.map((expense) => normalizeExpense(expense)).filter((expense) => expense.amount > 0 && expense.note)
      : [];
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

function createEditDraft(expense) {
  return {
    amount: String(expense.amount || ""),
    note: expense.note || "",
    splitPeople: String(expense.splitPeople || ""),
  };
}

function ExpenseSpentPanel({ memberRows = [], onClose, onToast }) {
  const sheetPeopleCount = memberRows.length || 1;
  const [expenses, setExpenses] = useState(() => getStoredExpenses());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [splitCount, setSplitCount] = useState(String(sheetPeopleCount));
  const [pin, setPin] = useState("");
  const [editorPin, setEditorPin] = useState(() => sessionStorage.getItem(SPENT_PIN_STORAGE_KEY) || "");
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editDraft, setEditDraft] = useState({ amount: "", note: "", splitPeople: "" });

  const isUnlocked = Boolean(editorPin);
  const totalSpent = useMemo(
    () => expenses.reduce((total, expense) => total + expense.amount, 0),
    [expenses],
  );
  const newExpenseSplitPeople = Math.max(getPositiveNumber(splitCount, sheetPeopleCount), 1);

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
          const nextExpenses = data.expenses
            .map((expense) => normalizeExpense(expense, sheetPeopleCount))
            .filter((expense) => expense.amount > 0 && expense.note);
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
  }, [onToast, sheetPeopleCount]);

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

  async function syncExpenses(nextExpenses, successMessage) {
    const normalizedExpenses = nextExpenses
      .map((expense) => normalizeExpense(expense, sheetPeopleCount))
      .filter((expense) => expense.amount > 0 && expense.note);

    setExpenses(normalizedExpenses);

    try {
      setIsSyncing(true);
      const data = await saveSpentExpenses({ expenses: normalizedExpenses, pin: editorPin });

      if (Array.isArray(data.expenses)) {
        setExpenses(data.expenses.map((expense) => normalizeExpense(expense, sheetPeopleCount)).filter((expense) => expense.amount > 0 && expense.note));
      }

      onToast("success", successMessage);
    } catch (error) {
      onToast("error", error.message || "Spent expense sync failed");
    } finally {
      setIsSyncing(false);
    }
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
      splitPeople: newExpenseSplitPeople,
    }, sheetPeopleCount);

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
        setExpenses(data.expenses.map((expense) => normalizeExpense(expense, sheetPeopleCount)).filter((expense) => expense.amount > 0 && expense.note));
      }

      setAmount("");
      setNote("");
      setSplitCount(String(sheetPeopleCount));
      onToast("success", "Spent expense added");
    } catch (error) {
      onToast("error", error.message || "Spent expense sync failed");
    } finally {
      setIsSyncing(false);
    }
  }

  function startEdit(expense) {
    setEditingId(expense.id);
    setEditDraft(createEditDraft(expense));
  }

  function cancelEdit() {
    setEditingId("");
    setEditDraft({ amount: "", note: "", splitPeople: "" });
  }

  function handleEditChange(field, value) {
    setEditDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
  }

  function handleEditSubmit(event, expense) {
    event.preventDefault();

    const nextExpense = normalizeExpense({ ...expense, ...editDraft }, sheetPeopleCount);

    if (nextExpense.amount <= 0) {
      onToast("error", "Enter a valid spent amount");
      return;
    }

    if (!nextExpense.note) {
      onToast("error", "Add a note for why we spent it");
      return;
    }

    const nextExpenses = expenses.map((currentExpense) => (currentExpense.id === expense.id ? nextExpense : currentExpense));
    cancelEdit();
    syncExpenses(nextExpenses, "Spent expense updated");
  }

  return (
    <section className="spent-panel" aria-label="Expense spent">
      <div className="table-heading">
        <div>
          <p className="eyebrow">Expense spent</p>
          <h2>Trip spending log</h2>
        </div>
        <div className="table-actions">
          <span>Rs {formatMoney(totalSpent)} total spent</span>
          <button className="close-panel-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="spent-access-card">
        <div>
          <h3>{isUnlocked ? "Kalai editor unlocked" : "View only"}</h3>
          <p>{isUnlocked ? "Add amount, note and split people without entering Trip PIN again." : "Enter Trip PIN once to add or edit spent expenses."}</p>
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
          <label>
            Split people
            <input
              type="number"
              min="1"
              step="1"
              value={splitCount}
              onChange={(event) => setSplitCount(event.target.value)}
              placeholder={`${sheetPeopleCount} people`}
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
          expenses.map((expense) => {
            const isEditing = editingId === expense.id;
            const entrySplitPeople = Math.max(getPositiveNumber(expense.splitPeople, sheetPeopleCount), 1);
            const perHeadAmount = Math.ceil(expense.amount / entrySplitPeople);

            return (
              <article className="spent-item" key={expense.id}>
                {isEditing ? (
                  <form className="spent-edit-form" onSubmit={(event) => handleEditSubmit(event, expense)}>
                    <label>
                      Amount
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={editDraft.amount}
                        onChange={(event) => handleEditChange("amount", event.target.value)}
                      />
                    </label>
                    <label>
                      Note
                      <input
                        type="text"
                        value={editDraft.note}
                        onChange={(event) => handleEditChange("note", event.target.value)}
                      />
                    </label>
                    <label>
                      Split people
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={editDraft.splitPeople}
                        onChange={(event) => handleEditChange("splitPeople", event.target.value)}
                      />
                    </label>
                    <div className="spent-edit-actions">
                      <button type="submit" disabled={isSyncing}>Save</button>
                      <button type="button" onClick={cancelEdit}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div>
                      <h3>{expense.note}</h3>
                      <p>{formatDate(expense.createdAt)}</p>
                    </div>
                    <div className="spent-item-side">
                      <div className="spent-amount-stack">
                        <strong>Rs {formatMoney(perHeadAmount)} per head</strong>
                        <span>Total Rs {formatMoney(expense.amount)} split by {entrySplitPeople} people</span>
                      </div>
                      {isUnlocked && (
                        <button className="spent-edit-button" type="button" onClick={() => startEdit(expense)}>
                          Edit
                        </button>
                      )}
                    </div>
                  </>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

export default ExpenseSpentPanel;
