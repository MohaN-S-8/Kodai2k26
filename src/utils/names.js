export function isNumber(value) {
  return /^\d+$/.test(String(value || "").trim());
}

export function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export function findMemberByName(memberRows, typedName) {
  const normalizedTypedName = normalizeName(typedName);

  if (!normalizedTypedName) {
    return null;
  }

  return (
    memberRows.find((row) => normalizeName(row.Name) === normalizedTypedName) ||
    memberRows.find((row) => normalizeName(row.Name).includes(normalizedTypedName)) ||
    null
  );
}
