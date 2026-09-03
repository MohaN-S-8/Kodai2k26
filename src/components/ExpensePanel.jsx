import { useEffect, useId, useMemo, useState } from "react";
import { BALANCE_COLUMN, COLUMN_LABELS, COMMON_COSTS, MONEY_COLUMNS } from "../data/tripConfig";
import { createPaymentLinks, hasPaymentReceiver } from "../lib/payment";
import { formatMoney, getMoneyNumber } from "../utils/money";
import { normalizeName } from "../utils/names";

const EXPENSE_UPDATE_PIN = import.meta.env.VITE_TRIP_UPDATE_PIN || "";

function isFullyPaid(member) {
  return getMoneyNumber(member?.[BALANCE_COLUMN]) <= 0;
}

function PaymentCard({ error, isUpdating, member, memberRows, nameError, names = [], onSelectMember, onUpdatePayment }) {
  const [name, setName] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerAmount, setManagerAmount] = useState("");
  const [managerPin, setManagerPin] = useState("");
  const [managerPinError, setManagerPinError] = useState("");
  const [isManagerUnlocked, setIsManagerUnlocked] = useState(false);

  const namesListId = useId();
  const isManager = normalizeName(member?.Name) === "kalai";
  const managerTarget = useMemo(
    () => memberRows.find((row) => row.Name === managerName) || null,
    [managerName, memberRows]
  );

  useEffect(() => {
    setManagerName(member?.Name || "");
    setManagerAmount(member?.["Total given"] || "");
    setManagerPin("");
    setManagerPinError("");
    setIsManagerUnlocked(false);
  }, [member]);

  useEffect(() => {
    if (managerTarget) {
      setManagerAmount(managerTarget["Total given"] || "");
    }
  }, [managerTarget]);

  if (!member) {
    return (
      <section className="payment-card payment-card-verify" aria-label="Verify your trip payment balance">
        <form
          className="payment-verify-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSelectMember(name);
          }}
        >
          <div>
            <p className="eyebrow">Verify urself</p>
            <h2>Select your name</h2>
          </div>
          <input
            autoFocus
            list={namesListId}
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Type or select name"
            aria-label="Your name in the trip sheet"
          />
          <datalist id={namesListId}>
            {names.map((nameOption) => (
              <option key={nameOption} value={nameOption} />
            ))}
          </datalist>
          {nameError && <p className="payment-error">{nameError}</p>}
          <button type="submit" disabled={!name.trim()}>
            Show Balance
          </button>
        </form>
      </section>
    );
  }

  const balanceAmount = getMoneyNumber(member[BALANCE_COLUMN]);
  const paymentLinks = createPaymentLinks({
    amount: balanceAmount,
    payerName: member.Name,
  });
  const canPay = hasPaymentReceiver() && balanceAmount > 0;
function handleManagerPinSubmit(event) {
    event.preventDefault();

    if (!EXPENSE_UPDATE_PIN) {
      setManagerPinError("Missing VITE_TRIP_UPDATE_PIN in env");
      return;
    }

    if (managerPin.trim() !== EXPENSE_UPDATE_PIN) {
      setIsManagerUnlocked(false);
      setManagerPinError("Trip PIN is wrong");
      return;
    }

    setIsManagerUnlocked(true);
    setManagerPinError("");
  }

  function handleManagerSubmit(event) {
    event.preventDefault();
    onUpdatePayment({ name: managerName, totalGiven: managerAmount, pin: managerPin });
  }

  return (
    <section className="payment-card" aria-label="Your payment balance">
      <div className="payment-info">
        <p className="eyebrow">Matched from sheet</p>
        <h2>{member.Name}</h2>
        <span>Balance: Rs {formatMoney(balanceAmount)}</span>
      </div>

      {isManager && !isManagerUnlocked && (
        <form className="payment-edit-form" onSubmit={handleManagerPinSubmit}>
          <label>
            Trip PIN
            <input
              type="password"
              value={managerPin}
              onChange={(event) => setManagerPin(event.target.value)}
              placeholder="Enter Trip PIN"
            />
          </label>
          {managerPinError && <p className="payment-error">{managerPinError}</p>}
          <button type="submit" disabled={!managerPin.trim()}>
            Unlock edit option
          </button>
        </form>
      )}

      {isManager && isManagerUnlocked && (
        <form className="payment-edit-form manager-form" onSubmit={handleManagerSubmit}>
          <label>
            Select name
            <select
              value={managerName}
              onChange={(event) => setManagerName(event.target.value)}
            >
              {memberRows.map((row) => (
                <option key={row.Name} value={row.Name}>
                  {row.Name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Total given
            <input
              type="number"
              min="0"
              step="1"
              value={managerAmount}
              onChange={(event) => setManagerAmount(event.target.value)}
              placeholder="Payment amount"
            />
          </label>
          {error && <p className="payment-error">{error}</p>}
          <button type="submit" disabled={isUpdating || !managerName}>
            {isUpdating ? "Updating..." : "Update Selected"}
          </button>
        </form>
      )}

      {canPay ? (
        <a className="payment-button" href={paymentLinks.gpay}>
          Pay Rs {formatMoney(balanceAmount)} via GPay
        </a>
      ) : (
        <p className="payment-note">
          Add VITE_PAYMENT_UPI_ID in env to enable the GPay payment button.
        </p>
      )}
    </section>
  );
}

function ExpensePanel({
  displayColumns,
  memberRows,
  paymentUpdateError,
  isUpdatingPayment,
  nameError,
  names,
  selectedMember,
  onClose,
  onSelectMember,
  onUpdatePayment,
}) {
  const visibleColumns = displayColumns.filter((column) => column !== "No");

  return (
    <>
      <PaymentCard
        error={paymentUpdateError}
        isUpdating={isUpdatingPayment}
        member={selectedMember}
        memberRows={memberRows}
        nameError={nameError}
        names={names}
        onSelectMember={onSelectMember}
        onUpdatePayment={onUpdatePayment}
      />

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
            <h2>Payment Status</h2>
          </div>
          <div className="table-actions">
            <span>{memberRows.length} people listed</span>
            <button
              className="close-panel-button"
              type="button"
              aria-label="Close overall cost and expense"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {visibleColumns.map((column) => (
                  <th key={column}>{COLUMN_LABELS[column] || column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {memberRows.map((row, rowIndex) => (
                <tr
                  className={isFullyPaid(row) ? "is-paid" : ""}
                  key={`${row.No}-${row.Name}-${rowIndex}`}
                >
                  {visibleColumns.map((column) => (
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
  );
}

export default ExpensePanel;
