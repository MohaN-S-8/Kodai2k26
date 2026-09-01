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

export default async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const sheetUrl = process.env.TRIP_SHEET_CSV_URL || process.env.VITE_TRIP_SHEET_CSV_URL;

  if (!sheetUrl) {
    response.status(500).json({ error: "Missing TRIP_SHEET_CSV_URL environment variable" });
    return;
  }

  try {
    const cleanUrl = sheetUrl.replace(/\\&/g, "&").trim();
    const sheetResponse = await fetch(cleanUrl);

    if (!sheetResponse.ok) {
      response.status(sheetResponse.status).json({
        error: `Google Sheet fetch failed with ${sheetResponse.status}`,
      });
      return;
    }

    const csvText = await sheetResponse.text();
    response.status(200).json(parseCsv(csvText));
  } catch (error) {
    response.status(500).json({ error: error.message || "Failed to fetch sheet" });
  }
}
