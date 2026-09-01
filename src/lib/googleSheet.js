const DEFAULT_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTgOGRw_DBXXL8TglmgVQoTALKVdc7nN02CMg1x02_wFAyaJi_Fg74UG0I30uWp6I4PuDJmLavPJbQh/pub?gid=221370713&single=true&output=csv";

const SHEET_CSV_URL =
  import.meta.env.VITE_TRIP_SHEET_CSV_URL || DEFAULT_SHEET_CSV_URL;

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsv(csvText) {
  const lines = csvText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { columns: [], rows: [] };
  }

  const columns = parseCsvLine(lines[0]).map((column, index) =>
    column || `Column ${index + 1}`
  );

  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);

    return columns.reduce((row, column, index) => {
      row[column] = values[index] || "";
      return row;
    }, {});
  });

  return { columns, rows };
}

export async function fetchTripSheetData() {
  const response = await fetch(SHEET_CSV_URL);

  if (!response.ok) {
    throw new Error(`Google Sheet fetch failed with ${response.status}`);
  }

  const csvText = await response.text();
  return parseCsv(csvText);
}
