export function formatMoney(value) {
  const number = Number(String(value || "").replace(/,/g, ""));

  if (!Number.isFinite(number)) {
    return value || "-";
  }

  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(number);
}

export function getMoneyNumber(value) {
  const number = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}
