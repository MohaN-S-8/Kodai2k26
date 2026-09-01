import { createSign } from "node:crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const CSV_URL = process.env.TRIP_SHEET_CSV_URL || process.env.VITE_TRIP_SHEET_CSV_URL;
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_SPREADSHEET_ID;
const SHEET_GID = process.env.GOOGLE_SHEET_GID;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME;
const UPDATE_PIN = process.env.TRIP_UPDATE_PIN;

function base64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function normalizePrivateKey(value) {
  return String(value || "").replace(/\\n/g, "\n");
}

function getGoogleCredentials() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY);

  if (!clientEmail || !privateKey) {
    return null;
  }

  return { clientEmail, privateKey };
}

async function getAccessToken() {
  const credentials = getGoogleCredentials();

  if (!credentials) {
    throw new Error("Missing Google service account credentials");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(
    JSON.stringify({
      iss: credentials.clientEmail,
      scope: SHEETS_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      exp: now + 3600,
      iat: now,
    }),
  );
  const unsignedToken = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const signature = signer
    .sign(credentials.privateKey, "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsignedToken}.${signature}`,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Google auth failed: ${await tokenResponse.text()}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

function cleanHeader(value, index) {
  return String(value || "").replace(/\s+/g, " ").trim() || `Column ${index + 1}`;
}

function recordsToData(records) {
  if (records.length === 0) {
    return { columns: [], rows: [] };
  }

  const columns = records[0].map(cleanHeader);
  const rows = records.slice(1).map((values, rowIndex) => {
    const row = columns.reduce((result, column, index) => {
      result[column] = values[index] || "";
      return result;
    }, {});

    row.__rowNumber = rowIndex + 2;
    return row;
  });

  return { columns, rows };
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

  return recordsToData(records);
}

function quoteSheetName(sheetName) {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

function columnLetter(columnIndex) {
  let index = columnIndex + 1;
  let letters = "";

  while (index > 0) {
    const remainder = (index - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    index = Math.floor((index - 1) / 26);
  }

  return letters;
}

function assertSpreadsheetConfig() {
  if (!SPREADSHEET_ID) {
    throw new Error("Missing GOOGLE_SHEET_SPREADSHEET_ID environment variable");
  }
}

async function sheetsRequest(path, options = {}) {
  const accessToken = await getAccessToken();
  const apiResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    },
  );

  if (!apiResponse.ok) {
    throw new Error(`Google Sheets API failed: ${await apiResponse.text()}`);
  }

  return apiResponse.json();
}

async function getSheetTitle() {
  if (SHEET_NAME) {
    return SHEET_NAME;
  }

  const metadata = await sheetsRequest("?fields=sheets.properties(sheetId,title)");
  const sheet = metadata.sheets.find(
    (entry) => String(entry.properties.sheetId) === String(SHEET_GID),
  );

  if (!sheet) {
    throw new Error(`No sheet tab found for gid ${SHEET_GID}`);
  }

  return sheet.properties.title;
}

async function readFromSheetsApi() {
  const sheetTitle = await getSheetTitle();
  const range = `${quoteSheetName(sheetTitle)}!A:Z`;
  const data = await sheetsRequest(`/values/${encodeURIComponent(range)}`);
  return recordsToData(data.values || []);
}

async function readFromCsv() {
  if (!CSV_URL) {
    throw new Error("Missing TRIP_SHEET_CSV_URL environment variable");
  }

  const cleanUrl = CSV_URL.replace(/\\&/g, "&").trim();
  const sheetResponse = await fetch(cleanUrl);

  if (!sheetResponse.ok) {
    throw new Error(`Google Sheet fetch failed with ${sheetResponse.status}`);
  }

  return parseCsv(await sheetResponse.text());
}

async function readSheet() {
  return getGoogleCredentials() ? readFromSheetsApi() : readFromCsv();
}

function assertUpdatePin(request) {
  if (!UPDATE_PIN) {
    throw new Error("Missing TRIP_UPDATE_PIN environment variable");
  }

  const submittedPin = request.headers["x-trip-update-pin"];

  if (!submittedPin || String(submittedPin) !== UPDATE_PIN) {
    const error = new Error("Invalid update PIN");
    error.statusCode = 401;
    throw error;
  }
}

async function updateTotalGiven({ name, totalGiven }) {
  if (!getGoogleCredentials()) {
    throw new Error("Sheet editing needs Google service account env vars on Vercel");
  }

  const cleanName = String(name || "").trim().toLowerCase();
  const cleanAmount = String(totalGiven || "").replace(/[^0-9.]/g, "").trim();

  if (!cleanName || !cleanAmount) {
    throw new Error("Name and payment amount are required");
  }

  const sheetTitle = await getSheetTitle();
  const range = `${quoteSheetName(sheetTitle)}!A:Z`;
  const data = await sheetsRequest(`/values/${encodeURIComponent(range)}`);
  const values = data.values || [];
  const columns = (values[0] || []).map(cleanHeader);
  const nameIndex = columns.indexOf("Name");
  const totalGivenIndex = columns.indexOf("Total given");

  if (nameIndex === -1 || totalGivenIndex === -1) {
    throw new Error("Sheet must contain Name and Total given columns");
  }

  const targetIndex = values.findIndex(
    (row, index) =>
      index > 0 && String(row[nameIndex] || "").trim().toLowerCase() === cleanName,
  );

  if (targetIndex === -1) {
    throw new Error("Name not found in Google Sheet");
  }

  const cell = `${columnLetter(totalGivenIndex)}${targetIndex + 1}`;
  const updateRange = `${quoteSheetName(sheetTitle)}!${cell}`;

  await sheetsRequest(`/values/${encodeURIComponent(updateRange)}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: JSON.stringify({ values: [[cleanAmount]] }),
  });

  return readFromSheetsApi();
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export default async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Methods", "GET,PATCH,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,X-Trip-Update-Pin");
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  try {
    if (request.method === "GET") {
      response.status(200).json(await readSheet());
      return;
    }

    if (request.method === "PATCH") {
      assertUpdatePin(request);
      response.status(200).json(await updateTotalGiven(await readJsonBody(request)));
      return;
    }

    response.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message || "Sheet request failed",
    });
  }
}



