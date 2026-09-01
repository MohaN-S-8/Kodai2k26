import { useEffect, useMemo, useState } from "react";
import { BALANCE_COLUMN, COLUMN_LABELS, COMMON_COSTS, MONEY_COLUMNS } from "../data/tripConfig";
import { createPaymentLinks, hasPaymentReceiver } from "../lib/payment";
import { formatMoney, getMoneyNumber } from "../utils/money";
import { normalizeName } from "../utils/names";

function isFullyPaid(member) {
  return getMoneyNumber(member?.[BALANCE_COLUMN]) <= 0;
}

function PaymentCard({ error, isUpdating, member, memberRows, onUpdatePayment }) {
const [managerName, setManagerName] = useState("");
  const [managerAmount, setManagerAmount] = useState("");
  const [managerPin, setManagerPin] = useState("");

  const isManager = normalizeName(member?.Name) === "kalai";
  const managerTarget = useMemo(
    () => memberRows.find((row) => row.Name === managerName) || null,
    [managerName, memberRows]
  );

  useEffect(() => {
setManagerName(member?.Name || "");
    setManagerAmount(member?.["Total given"] || "");
    setManagerPin("");
  }, [member]);

  useEffect(() => {
    if (managerTarget) {
      setManagerAmount(managerTarget["Total given"] || "");
    }
  }, [managerTarget]);

  if (!member) {
    return null;
  }

  const balanceAmount = getMoneyNumber(member[BALANCE_COLUMN]);
  const paymentLinks = createPaymentLinks({
    amount: balanceAmount,
    payerName: member.Name,
  });
  const canPay = hasPaymentReceiver() && balanceAmount > 0;
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

      {isManager && (
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
          <label>
            Update PIN
            <input
              type="password"
              value={managerPin}
              onChange={(event) => setManagerPin(event.target.value)}
              placeholder="Trip PIN"
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
  selectedMember,
  onClose,
  onUpdatePayment,
}) {
  return (
    <>
      <PaymentCard
        error={paymentUpdateError}
        isUpdating={isUpdatingPayment}
        member={selectedMember}
        memberRows={memberRows}
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
                {displayColumns.map((column) => (
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
  );
}

export default ExpensePanel;

