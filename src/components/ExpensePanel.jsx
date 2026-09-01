import { COMMON_COSTS, COLUMN_LABELS, MONEY_COLUMNS, BALANCE_COLUMN } from "../data/tripConfig";
import { createPaymentLinks, hasPaymentReceiver } from "../lib/payment";
import { formatMoney, getMoneyNumber } from "../utils/money";

function PaymentCard({ member }) {
  if (!member) {
    return null;
  }

  const balanceAmount = getMoneyNumber(member[BALANCE_COLUMN]);
  const paymentLinks = createPaymentLinks({
    amount: balanceAmount,
    payerName: member.Name,
  });
  const canPay = hasPaymentReceiver() && balanceAmount > 0;

  return (
    <section className="payment-card" aria-label="Your payment balance">
      <div>
        <p className="eyebrow">Matched from sheet</p>
        <h2>{member.Name}</h2>
        <span>Balance: Rs {formatMoney(balanceAmount)}</span>
      </div>
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

function ExpensePanel({ displayColumns, memberRows, selectedMember, onClose }) {
  return (
    <>
      <PaymentCard member={selectedMember} />

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
  );
}

export default ExpensePanel;
