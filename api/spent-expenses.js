import { createSign } from "node:crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_SPREADSHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SPENT_EXPENSES_SHEET_NAME || "Expense Spent";
const UPDATE_PIN = process.env.TRIP_UPDATE_PIN;
const HEADERS = ["id", "createdAt", "amount", "note"];

function base64Url(value) {
  return Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function normalizePrivateKey(value) {
  return String(value || "").replace(/\\n/g, "\n");
}

function getGoogleCredentials() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY);
  return clientEmail && privateKey ? { clientEmail, privateKey } : null;
}

async function getAccessToken() {
  const credentials = getGoogleCredentials();

  if (!credentials) {
    throw new Error("Missing Google service account credentials");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({ iss: credentials.clientEmail, scope: SHEETS_SCOPE, aud: GOOGLE_TOKEN_URL, exp: now + 3600, iat: now }));
  const unsignedToken = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(credentials.privateKey, "base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsignedToken}.${signature}` }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Google auth failed: ${await tokenResponse.text()}`);
  }

  return (await tokenResponse.json()).access_token;
}

function quoteSheetName(sheetName) {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

function assertSpreadsheetConfig() {
  if (!SPREADSHEET_ID) {
    throw new Error("Missing GOOGLE_SHEET_SPREADSHEET_ID environment variable");
  }
}

async function sheetsRequest(path, options = {}) {
  assertSpreadsheetConfig();
  const accessToken = await getAccessToken();
  const apiResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });

  if (!apiResponse.ok) {
    throw new Error(`Google Sheets API failed: ${await apiResponse.text()}`);
  }

  return apiResponse.json();
}

async function ensureSheetExists() {
  const metadata = await sheetsRequest("?fields=sheets.properties(title)");
  const exists = metadata.sheets?.some((entry) => entry.properties.title === SHEET_NAME);

  if (!exists) {
    await sheetsRequest(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] }),
    });
  }

  return SHEET_NAME;
}

function cleanSpentExpense(expense) {
  const amount = Number(String(expense.amount || 0).replace(/,/g, ""));

  return {
    id: String(expense.id || `spent-${Date.now()}`).trim(),
    createdAt: String(expense.createdAt || new Date().toISOString()).trim(),
    amount: Number.isFinite(amount) ? amount : 0,
    note: String(expense.note || "").trim(),
  };
}

function rowsToExpenses(rows) {
  return rows
    .map((row) => cleanSpentExpense({ id: row[0], createdAt: row[1], amount: row[2], note: row[3] }))
    .filter((expense) => expense.id && expense.amount > 0 && expense.note);
}

function expensesToRows(expenses) {
  return expenses.map(cleanSpentExpense).map((expense) => [expense.id, expense.createdAt, expense.amount, expense.note]);
}

async function readSpentExpenses() {
  await ensureSheetExists();
  const range = `${quoteSheetName(SHEET_NAME)}!A:D`;
  const data = await sheetsRequest(`/values/${encodeURIComponent(range)}`);
  const values = data.values || [];
  const hasHeaders = HEADERS.every((header, index) => values[0]?.[index] === header);

  if (!hasHeaders) {
    await sheetsRequest(`/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
      method: "PUT",
      body: JSON.stringify({ values: [HEADERS] }),
    });
    return { expenses: [] };
  }

  return { expenses: rowsToExpenses(values.slice(1)).sort((first, second) => second.createdAt.localeCompare(first.createdAt)) };
}

async function appendSpentExpense(expense) {
  await ensureSheetExists();
  const cleanExpense = cleanSpentExpense(expense);

  if (cleanExpense.amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  if (!cleanExpense.note) {
    throw new Error("Note is required");
  }

  const range = `${quoteSheetName(SHEET_NAME)}!A:D`;
  await sheetsRequest(`/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({ values: expensesToRows([cleanExpense]) }),
  });

  return readSpentExpenses();
}

function assertUpdatePin(request) {
  if (!UPDATE_PIN) {
    throw new Error("Missing TRIP_UPDATE_PIN environment variable");
  }

  if (String(request.headers["x-trip-update-pin"] || "") !== UPDATE_PIN) {
    const error = new Error("Invalid update PIN");
    error.statusCode = 401;
    throw error;
  }
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

export default async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
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
      response.status(200).json(await readSpentExpenses());
      return;
    }

    if (request.method === "POST") {
      assertUpdatePin(request);
      response.status(200).json(await appendSpentExpense((await readJsonBody(request)).expense || {}));
      return;
    }

    response.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message || "Spent expenses request failed" });
  }
}
