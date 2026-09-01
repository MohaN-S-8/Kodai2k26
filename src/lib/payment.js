const PAYMENT_UPI_ID = import.meta.env.VITE_PAYMENT_UPI_ID || "";
const PAYMENT_PAYEE_NAME = import.meta.env.VITE_PAYMENT_PAYEE_NAME || "";
const PAYMENT_NOTE_PREFIX = import.meta.env.VITE_PAYMENT_NOTE_PREFIX || "Trip payment from";

function createUpiParams({ amount, payerName }) {
  const params = new URLSearchParams({
    pa: PAYMENT_UPI_ID,
    pn: PAYMENT_PAYEE_NAME,
    am: String(amount),
    cu: "INR",
    tn: `${PAYMENT_NOTE_PREFIX} ${payerName}`,
  });

  return params.toString();
}

export function hasPaymentReceiver() {
  return Boolean(PAYMENT_UPI_ID);
}

export function createPaymentLinks({ amount, payerName }) {
  const params = createUpiParams({ amount, payerName });

  return {
    gpay: `gpay://upi/pay?${params}`,
    upi: `upi://pay?${params}`,
  };
}


