import { createSign } from "node:crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const CSV_URL = process.env.FOOD_EXPENSES_CSV_URL || process.env.VITE_FOOD_EXPENSES_CSV_URL;
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_SPREADSHEET_ID;
const SHEET_GID = process.env.GOOGLE_FOOD_EXPENSES_GID;
const SHEET_NAME = process.env.GOOGLE_FOOD_EXPENSES_SHEET_NAME;
const UPDATE_PIN = process.env.TRIP_UPDATE_PIN;
const HEADERS = ["id", "day", "meal", "amount", "paidNames"];

const DEFAULT_FOOD_EXPENSES = [
  { id: "day-1-breakfast", day: "Day 1", meal: "Breakfast", amount: 0, paidNames: [] },
  { id: "day-1-lunch", day: "Day 1", meal: "Lunch", amount: 0, paidNames: [] },
  { id: "day-1-dinner", day: "Day 1", meal: "Dinner", amount: 0, paidNames: [] },
  { id: "day-1-snacks", day: "Day 1", meal: "Snacks", amount: 0, paidNames: [] },
];

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

async function getSheetTitle() {
  if (SHEET_NAME) {
    return SHEET_NAME;
  }

  const metadata = await sheetsRequest("?fields=sheets.properties(sheetId,title)");
  const sheet = metadata.sheets.find((entry) => String(entry.properties.sheetId) === String(SHEET_GID));

  if (!sheet) {
    throw new Error(`No food expenses sheet tab found for gid ${SHEET_GID}`);
  }

  return sheet.properties.title;
}

function parsePaidNames(value) {
  return String(value || "")
    .split("|")
    .map((name) => name.trim())
    .filter(Boolean);
}

function cleanExpense(expense) {
  const amount = Number(String(expense.amount || 0).replace(/,/g, ""));

  return {
    id: String(expense.id || "").trim(),
    day: String(expense.day || "Day 1").trim(),
    meal: String(expense.meal || "Food").trim(),
    amount: Number.isFinite(amount) ? amount : 0,
    paidNames: Array.isArray(expense.paidNames) ? expense.paidNames.map(String).filter(Boolean) : parsePaidNames(expense.paidNames),
  };
}

function rowsToExpenses(rows) {
  return rows
    .map((row) => cleanExpense({ id: row[0], day: row[1], meal: row[2], amount: row[3], paidNames: row[4] }))
    .filter((expense) => expense.id && expense.day && expense.meal);
}

function expensesToRows(expenses) {
  return expenses
    .map(cleanExpense)
    .filter((expense) => expense.id && expense.day && expense.meal)
    .map((expense) => [expense.id, expense.day, expense.meal, expense.amount, expense.paidNames.join("|")]);
}

async function readFromSheetsApi() {
  const sheetTitle = await getSheetTitle();
  const range = `${quoteSheetName(sheetTitle)}!A:E`;
  const data = await sheetsRequest(`/values/${encodeURIComponent(range)}`);
  const values = data.values || [];
  const hasHeaders = HEADERS.every((header, index) => values[0]?.[index] === header);
  const expenses = rowsToExpenses(hasHeaders ? values.slice(1) : values);

  if (!hasHeaders || values.length <= 1 || expenses.length === 0) {
    await writeExpensesToSheetsApi(DEFAULT_FOOD_EXPENSES);
    return { expenses: DEFAULT_FOOD_EXPENSES };
  }

  return { expenses };
}

async function writeExpensesToSheetsApi(expenses) {
  const sheetTitle = await getSheetTitle();
  const range = `${quoteSheetName(sheetTitle)}!A:E`;
  const rows = expensesToRows(expenses);

  await sheetsRequest(`/values/${encodeURIComponent(range)}:clear`, { method: "POST", body: JSON.stringify({}) });
  await sheetsRequest(`/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, { method: "PUT", body: JSON.stringify({ values: [HEADERS, ...rows] }) });

  return { expenses: rowsToExpenses(rows) };
}

function parseCsv(csvText) {
  const rows = csvText
    .split(/\r?\n/)
    .map((line) => line.split(",").map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean));
  const hasHeaders = HEADERS.every((header, index) => rows[0]?.[index] === header);
  return { expenses: rowsToExpenses(hasHeaders ? rows.slice(1) : rows) };
}

async function readFromCsv() {
  if (!CSV_URL) {
    return { expenses: DEFAULT_FOOD_EXPENSES };
  }

  const sheetResponse = await fetch(CSV_URL.replace(/\\&/g, "&").trim());

  if (!sheetResponse.ok) {
    return { expenses: DEFAULT_FOOD_EXPENSES };
  }

  const data = parseCsv(await sheetResponse.text());
  return data.expenses.length ? data : { expenses: DEFAULT_FOOD_EXPENSES };
}

async function readExpenses() {
  return getGoogleCredentials() ? readFromSheetsApi() : readFromCsv();
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
  response.setHeader("Access-Control-Allow-Methods", "GET,PUT,OPTIONS");
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
      response.status(200).json(await readExpenses());
      return;
    }

    if (request.method === "PUT") {
      assertUpdatePin(request);
      response.status(200).json(await writeExpensesToSheetsApi((await readJsonBody(request)).expenses || []));
      return;
    }

    response.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message || "Food expenses request failed" });
  }
}
