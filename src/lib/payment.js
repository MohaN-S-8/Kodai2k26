const PAYMENT_UPI_ID = import.meta.env.VITE_PAYMENT_UPI_ID || "";
const PAYMENT_PAYEE_NAME = import.meta.env.VITE_PAYMENT_PAYEE_NAME || "Kodai Trip";

function createUpiParams({ amount, payerName }) {
  const params = new URLSearchParams({
    pa: PAYMENT_UPI_ID,
    pn: PAYMENT_PAYEE_NAME,
    am: String(amount),
    cu: "INR",
    tn: `Kodai trip balance from ${payerName}`,
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
