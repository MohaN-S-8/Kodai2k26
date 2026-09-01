const SHEET_CSV_URL = import.meta.env.VITE_TRIP_SHEET_CSV_URL;
const SHEET_API_URL = import.meta.env.VITE_TRIP_SHEET_API_URL;

function withCacheBust(url) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}_=${Date.now()}`;
}

function parseCsv(csvText) {
  const records = [];
  let field = "";
  let record = [];
  let insideQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      record.push(field.trim());
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      record.push(field.trim());
      field = "";

      if (record.some((value) => value.length > 0)) {
        records.push(record);
      }

      record = [];
      continue;
    }

    field += char;
  }

  record.push(field.trim());

  if (record.some((value) => value.length > 0)) {
    records.push(record);
  }

  if (records.length === 0) {
    return { columns: [], rows: [] };
  }

  const columns = records[0]
    .map((column) => column.replace(/\s+/g, " ").trim())
    .map((column, index) => column || `Column ${index + 1}`);

  const rows = records.slice(1).map((values) => {
    return columns.reduce((row, column, index) => {
      row[column] = values[index] || "";
      return row;
    }, {});
  });

  return { columns, rows };
}

async function readJsonResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 404 && SHEET_API_URL === "/api/sheet") {
      throw new Error(
        "Local payment updates need Vercel dev. Stop npm run dev and run: npx vercel dev",
      );
    }

    throw new Error(data.error || `Request failed with ${response.status}`);
  }

  return data;
}

async function fetchFromApi() {
  const response = await fetch(withCacheBust(SHEET_API_URL), {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
    },
  });
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("Trip sheet API did not return JSON");
  }

  return readJsonResponse(response);
}

async function fetchFromCsv() {
  if (!SHEET_CSV_URL) {
    throw new Error("Missing VITE_TRIP_SHEET_CSV_URL environment variable");
  }

  const cleanUrl = SHEET_CSV_URL.replace(/\\&/g, "&").trim();
  const response = await fetch(withCacheBust(cleanUrl), { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Google Sheet fetch failed with ${response.status}`);
  }

  const csvText = await response.text();
  return parseCsv(csvText);
}

export async function fetchTripSheetData() {
  if (SHEET_API_URL) {
    try {
      return await fetchFromApi();
    } catch (apiError) {
      if (!SHEET_CSV_URL) {
        throw apiError;
      }
    }
  }

  return fetchFromCsv();
}

export async function updateTripPayment({ name, totalGiven, pin }) {
  if (!SHEET_API_URL) {
    throw new Error("Payment updates need VITE_TRIP_SHEET_API_URL=/api/sheet");
  }

  const response = await fetch(SHEET_API_URL, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Trip-Update-Pin": pin,
    },
    body: JSON.stringify({ name, totalGiven }),
  });

  return readJsonResponse(response);
}




