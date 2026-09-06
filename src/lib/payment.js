const PAYMENT_UPI_ID = import.meta.env.VITE_PAYMENT_UPI_ID || "";
const PAYMENT_PAYEE_NAME = import.meta.env.VITE_PAYMENT_PAYEE_NAME || "";
const PAYMENT_NOTE_PREFIX = import.meta.env.VITE_PAYMENT_NOTE_PREFIX || "Trip payment from";

function formatUpiAmount(amount) {
  const number = Number(String(amount || "").replace(/,/g, ""));
  return Number.isFinite(number) ? number.toFixed(2) : "";
}

function createUpiParams({ amount, payerName }) {
  const upiAmount = formatUpiAmount(amount);
  const params = new URLSearchParams({
    pa: PAYMENT_UPI_ID,
    pn: PAYMENT_PAYEE_NAME,
    am: upiAmount,
    cu: "INR",
    tn: `${PAYMENT_NOTE_PREFIX} ${payerName}`,
  });

  return params.toString();
}

export function hasPaymentReceiver() {
  return Boolean(PAYMENT_UPI_ID);
}

export function getPaymentReceiver() {
  return {
    upiId: PAYMENT_UPI_ID,
    payeeName: PAYMENT_PAYEE_NAME,
  };
}

export function createPaymentLinks({ amount, payerName }) {
  const params = createUpiParams({ amount, payerName });

  return {
    gpay: `gpay://upi/pay?${params}`,
    upi: `upi://pay?${params}`,
  };
}






