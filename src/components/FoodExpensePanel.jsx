import { useEffect, useMemo, useState } from "react";
import { fetchFoodExpenses, saveFoodExpenses } from "../lib/foodExpenses";
import { normalizeName } from "../utils/names";
import { formatMoney } from "../utils/money";

const FOOD_STORAGE_KEY = "Kodaikanal-food-expenses";
const FOOD_UPDATE_PIN = import.meta.env.VITE_TRIP_UPDATE_PIN || "";
const PAYMENT_UPI_ID = import.meta.env.VITE_PAYMENT_UPI_ID || "";
const PAYMENT_PAYEE_NAME = import.meta.env.VITE_PAYMENT_PAYEE_NAME || "Kodai Trip";
const FOOD_REFRESH_INTERVAL_MS = Math.max(
  Number(
    import.meta.env.VITE_FOOD_EXPENSES_REFRESH_INTERVAL_MS ||
      import.meta.env.VITE_SHEET_REFRESH_INTERVAL_MS ||
      15000,
  ),
  5000,
);

const DEFAULT_FOOD_EXPENSES = [
  { id: "day-1-breakfast", day: "Day 1", meal: "Breakfast", amount: 0, paidNames: [] },
  { id: "day-1-lunch", day: "Day 1", meal: "Lunch", amount: 0, paidNames: [] },
  { id: "day-1-dinner", day: "Day 1", meal: "Dinner", amount: 0, paidNames: [] },
  { id: "day-1-snacks", day: "Day 1", meal: "Snacks", amount: 0, paidNames: [] },
  { id: "day-2-breakfast", day: "Day 2", meal: "Breakfast", amount: 0, paidNames: [] },
  { id: "day-2-lunch", day: "Day 2", meal: "Lunch", amount: 0, paidNames: [] },
  { id: "day-2-dinner", day: "Day 2", meal: "Dinner", amount: 0, paidNames: [] },
  { id: "day-2-snacks", day: "Day 2", meal: "Snacks", amount: 0, paidNames: [] },
];

function getStoredExpenses() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FOOD_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) && parsed.length ? mergeDefaultExpenses(parsed) : DEFAULT_FOOD_EXPENSES;
  } catch {
    return DEFAULT_FOOD_EXPENSES;
  }
}

function createExpenseId(day, meal) {
  return `${day}-${meal}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || `food-${Date.now()}`;
}

function normalizeExpense(expense) {
  const amount = Number(String(expense.amount || 0).replace(/,/g, ""));

  return {
    id: String(expense.id || createExpenseId(expense.day || "Day 1", expense.meal || "Food")).trim(),
    day: String(expense.day || "Day 1").trim(),
    meal: String(expense.meal || "Food").trim(),
    amount: Number.isFinite(amount) ? amount : 0,
    paidNames: Array.isArray(expense.paidNames) ? expense.paidNames.map(String).filter(Boolean) : [],
  };
}

function mergeDefaultExpenses(expenses) {
  const normalizedExpenses = expenses.map(normalizeExpense);
  const expensesById = new Map(normalizedExpenses.map((expense) => [expense.id, expense]));
  const defaultIds = new Set(DEFAULT_FOOD_EXPENSES.map((expense) => expense.id));
  const defaultExpenses = DEFAULT_FOOD_EXPENSES.map((expense) => expensesById.get(expense.id) || expense);
  const extraExpenses = normalizedExpenses.filter((expense) => !defaultIds.has(expense.id));

  return [...defaultExpenses, ...extraExpenses];
}
function buildUpiLink({ name, amount }) {
  if (!PAYMENT_UPI_ID || amount <= 0) {
    return "";
  }

  const params = new URLSearchParams({
    pa: PAYMENT_UPI_ID,
    pn: PAYMENT_PAYEE_NAME,
    am: String(amount),
    cu: "INR",
    tn: `Food expense split from ${name}`,
  });

  return `upi://pay?${params.toString()}`;
}

function FoodExpensePanel({ memberRows, onClose, onToast }) {
  const [expenses, setExpenses] = useState(() => getStoredExpenses());
  const [selectedName, setSelectedName] = useState(memberRows[0]?.Name || "");
  const [pin, setPin] = useState("");
  const [editorPin, setEditorPin] = useState("");
  const [isPinUnlocked, setIsPinUnlocked] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [draftAmounts, setDraftAmounts] = useState({});

  useEffect(() => {
    if (!selectedName && memberRows[0]?.Name) {
      setSelectedName(memberRows[0].Name);
    }
  }, [memberRows, selectedName]);

  useEffect(() => {
    let cancelled = false;

    async function loadExpenses({ silent = false } = {}) {
      try {
        if (!silent) {
          setIsSyncing(true);
        }

        const data = await fetchFoodExpenses();

        if (!cancelled && Array.isArray(data.expenses)) {
          const nextExpenses = mergeDefaultExpenses(data.expenses);
          setExpenses(nextExpenses);
          setDraftAmounts(Object.fromEntries(nextExpenses.map((expense) => [expense.id, String(expense.amount || "")])));
        }
      } catch (error) {
        if (!cancelled && !silent) {
          onToast("error", error.message || "Food expenses loaded from this browser only");
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
    }, FOOD_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, [onToast]);

  useEffect(() => {
    window.localStorage.setItem(FOOD_STORAGE_KEY, JSON.stringify(expenses));
  }, [expenses]);

  const peopleCount = memberRows.length || 1;
  const totalFoodAmount = useMemo(
    () => expenses.reduce((total, expense) => total + expense.amount, 0),
    [expenses]
  );
  const splitAmount = Math.ceil(totalFoodAmount / peopleCount);
  const selectedPaidAmount = useMemo(
    () => expenses.reduce((total, expense) => (
      expense.paidNames.some((name) => normalizeName(name) === normalizeName(selectedName))
        ? total + Math.ceil(expense.amount / peopleCount)
        : total
    ), 0),
    [expenses, peopleCount, selectedName]
  );
  const selectedBalance = Math.max(splitAmount - selectedPaidAmount, 0);
  const selectedHasPaidAll = selectedBalance <= 0 && totalFoodAmount > 0;
  const paymentLink = buildUpiLink({ name: selectedName, amount: selectedBalance });

  async function syncExpenses(nextExpenses, successMessage) {
    const normalizedExpenses = nextExpenses.map(normalizeExpense);
    setExpenses(normalizedExpenses);

    try {
      setIsSyncing(true);
      const data = await saveFoodExpenses({ expenses: normalizedExpenses, pin: editorPin });

      if (Array.isArray(data.expenses)) {
        const syncedExpenses = data.expenses.map(normalizeExpense);
        setExpenses(syncedExpenses);
        setDraftAmounts(Object.fromEntries(syncedExpenses.map((expense) => [expense.id, String(expense.amount || "")])));
      }

      onToast("success", successMessage);
    } catch (error) {
      onToast("error", error.message || "Food expenses sync failed");
    } finally {
      setIsSyncing(false);
    }
  }

  function handlePinSubmit(event) {
    event.preventDefault();

    if (pin.trim() !== FOOD_UPDATE_PIN) {
      setIsPinUnlocked(false);
      setEditorPin("");
      onToast("error", "Trip PIN is wrong");
      return;
    }

    setIsPinUnlocked(true);
    setEditorPin(pin.trim());
    setPin("");
    onToast("success", "Food expense update access unlocked");
  }

  function handleAmountChange(expenseId, value) {
    setDraftAmounts((currentAmounts) => ({ ...currentAmounts, [expenseId]: value }));
  }

  function handleSaveAmounts(event) {
    event.preventDefault();

    if (!isPinUnlocked) {
      onToast("error", "Enter Trip PIN to edit food expenses");
      return;
    }

    const nextExpenses = expenses.map((expense) => ({
      ...expense,
      amount: Number(draftAmounts[expense.id] || 0),
    }));

    syncExpenses(nextExpenses, "Food expense amounts updated");
  }

  function handleMarkSelectedPaid() {
    if (!isPinUnlocked) {
      onToast("error", "Enter Trip PIN to update payment status");
      return;
    }

    if (!selectedName) {
      onToast("error", "Select a name first");
      return;
    }

    const normalizedSelectedName = normalizeName(selectedName);
    const nextExpenses = expenses.map((expense) => ({
      ...expense,
      paidNames: expense.paidNames.some((name) => normalizeName(name) === normalizedSelectedName)
        ? expense.paidNames
        : [...expense.paidNames, selectedName],
    }));

    syncExpenses(nextExpenses, `${selectedName} marked paid for all food`);
  }
  function handleTogglePaid(expense) {
    if (!isPinUnlocked) {
      onToast("error", "Enter Trip PIN to update payment status");
      return;
    }

    if (!selectedName) {
      onToast("error", "Select a name first");
      return;
    }

    const normalizedSelectedName = normalizeName(selectedName);
    const isAlreadyPaid = expense.paidNames.some((name) => normalizeName(name) === normalizedSelectedName);
    const nextExpenses = expenses.map((currentExpense) => {
      if (currentExpense.id !== expense.id) {
        return currentExpense;
      }

      return {
        ...currentExpense,
        paidNames: isAlreadyPaid
          ? currentExpense.paidNames.filter((name) => normalizeName(name) !== normalizedSelectedName)
          : [...currentExpense.paidNames, selectedName],
      };
    });

    syncExpenses(nextExpenses, `${selectedName} ${isAlreadyPaid ? "marked unpaid" : "marked paid"} for ${expense.meal}`);
  }

  return (
    <section className="food-panel" aria-label="Food expense split">
      <div className="table-heading">
        <div>
          <p className="eyebrow">Food expense</p>
          <h2>2 days food split</h2>
        </div>
        <div className="table-actions">
          <span>{isSyncing ? "Syncing..." : `Rs ${formatMoney(totalFoodAmount)} total`}</span>
          <button className="close-panel-button" type="button" onClick={onClose}>Close</button>
        </div>
      </div>

      <div className="food-summary-grid">
        <article className="summary-card">
          <p>Total food</p>
          <strong>Rs {formatMoney(totalFoodAmount)}</strong>
          <span>Breakfast, lunch, dinner and snacks</span>
        </article>
        <article className="summary-card">
          <p>Split per person</p>
          <strong>Rs {formatMoney(splitAmount)}</strong>
          <span>{memberRows.length} people sharing this</span>
        </article>
        <article className="summary-card">
          <p>{selectedName || "Select name"}</p>
          <strong>Rs {formatMoney(selectedBalance)}</strong>
          <span>{selectedHasPaidAll ? "Paid for all food items" : "Current food balance"}</span>
        </article>
      </div>

      <div className="food-access-card">
        <label>
          Select your name
          <select value={selectedName} onChange={(event) => setSelectedName(event.target.value)}>
            {memberRows.map((row) => (
              <option key={row.Name} value={row.Name}>{row.Name}</option>
            ))}
          </select>
        </label>
        <a
          className={`payment-button ${!paymentLink || selectedHasPaidAll ? "is-disabled" : ""}`}
          href={paymentLink || undefined}
          aria-disabled={!paymentLink || selectedHasPaidAll}
        >
          {selectedHasPaidAll ? "Food paid" : `Pay Rs ${formatMoney(selectedBalance)} via GPay`}
        </a>
        {isPinUnlocked && !selectedHasPaidAll && (
          <button
            className="edit-place-button"
            type="button"
            disabled={!selectedName || isSyncing}
            onClick={handleMarkSelectedPaid}
          >
            Mark all food paid
          </button>
        )}
      </div>

      {!isPinUnlocked && (
        <form className="visiting-pin-form" onSubmit={handlePinSubmit}>
          <label>
            Trip PIN
            <input
              type="password"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder="Enter Trip PIN"
            />
          </label>
          <button type="submit" disabled={!pin.trim()}>Unlock food updates</button>
        </form>
      )}

      <form className="food-expense-list" onSubmit={handleSaveAmounts}>
        {expenses.map((expense) => {
          const itemSplit = Math.ceil(expense.amount / peopleCount);
          const isSelectedPaid = expense.paidNames.some((name) => normalizeName(name) === normalizeName(selectedName));

          return (
            <article className={`food-expense-card ${isSelectedPaid ? "is-paid" : ""}`} key={expense.id}>
              <div>
                <p className="eyebrow">{expense.day}</p>
                <h3>{expense.meal}</h3>
                <span>Rs {formatMoney(itemSplit)} per person</span>
              </div>

              <label>
                Total amount
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={draftAmounts[expense.id] ?? String(expense.amount || "")}
                  onChange={(event) => handleAmountChange(expense.id, event.target.value)}
                  disabled={!isPinUnlocked || isSyncing}
                />
              </label>

              <button
                className="edit-place-button"
                type="button"
                disabled={!isPinUnlocked || !selectedName || isSyncing}
                onClick={() => handleTogglePaid(expense)}
              >
                {isSelectedPaid ? "Mark unpaid" : "Mark paid"}
              </button>

              <small>
                {expense.paidNames.length
                  ? `Paid: ${expense.paidNames.join(", ")}`
                  : "No one marked paid yet"}
              </small>
            </article>
          );
        })}

        {isPinUnlocked && (
          <button className="food-save-button" type="submit" disabled={isSyncing}>Save food amounts</button>
        )}
      </form>
    </section>
  );
}

export default FoodExpensePanel;
