import { createSign } from "node:crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const CSV_URL = process.env.VISITING_PLACES_CSV_URL || process.env.VITE_VISITING_PLACES_CSV_URL;
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_SPREADSHEET_ID;
const SHEET_GID = process.env.GOOGLE_VISITING_PLACES_GID;
const SHEET_NAME = process.env.GOOGLE_VISITING_PLACES_SHEET_NAME;
const UPDATE_PIN = process.env.TRIP_UPDATE_PIN;
const HEADERS = ["id", "name", "cost", "note", "visited", "custom"];

const DEFAULT_PLACES = [
  { id: "kodaikanal-lake", name: "Kodaikanal Lake", cost: "Free", note: "Kodaikanal, Tamil Nadu 624101.", visited: false, custom: false },
  { id: "bryant-park", name: "Bryant Park", cost: "Rs 30 approx", note: "6FJV+H7W, Lower Shola Rd, Kodaikanal, Tamil Nadu 624101.", visited: false, custom: false },
  { id: "coakers-walk", name: "Coaker's Walk", cost: "Rs 20-30 approx", note: "Kodaikanal, Tamil Nadu 624101.", visited: false, custom: false },
  { id: "guna-cave", name: "Guna Cave", cost: "Rs 10 approx", note: "Pillar Rocks Rd, Kodaikanal, Vellagavi, Tamil Nadu 624103.", visited: false, custom: false },
  { id: "pillar-rocks", name: "Pillar Rocks", cost: "Rs 10 approx", note: "Pillar Rocks Rd, Tamil Nadu 624103.", visited: false, custom: false },
  { id: "pine-forest", name: "Pine Forest", cost: "Free", note: "6F75+FG4, Lake Rd, Berijam, Kodaikanal, Tamil Nadu 624103.", visited: false, custom: false },
  { id: "moir-point", name: "Moir Point", cost: "Free", note: "6C6X+57V, Ten Mile Round, Poombarai, Tamil Nadu 624103.", visited: false, custom: false },
  { id: "solar-observatory-museum", name: "Kodaikanal Solar Observatory Museum Block", cost: "Under Rs 500", note: "6FJ8+V5C, Poombarai, Tamil Nadu 624103.", visited: false, custom: false },
  { id: "fairy-falls", name: "Fairy Falls", cost: "Free", note: "6FF8+FQH, Fairy Falls Rd, Kodaikanal, Tamil Nadu 624103.", visited: false, custom: false },
  { id: "zion-elite-residency", name: "Zion Elite Residency", cost: "Stay", note: "Misty Mountains, 500N, Chinnapalam Road, Naidupuram, Vilpatti, Tamil Nadu 624101.", visited: false, custom: false },
  { id: "poombarai", name: "Poombarai", cost: "Free", note: "Poombarai, Tamil Nadu.", visited: false, custom: false },
  { id: "poombarai-view-point", name: "Poombarai View Point", cost: "Free", note: "7C25+J55, Mannavanur to Kodaikanal Rd, Poombarai, Tamil Nadu 624103.", visited: false, custom: false },
  { id: "perumbakkam-main-road", name: "Perumbakkam Main Rd", cost: "Free", note: "Perumbakkam Main Rd, Tamil Nadu.", visited: false, custom: false },
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
    throw new Error(`No visiting places sheet tab found for gid ${SHEET_GID}`);
  }

  return sheet.properties.title;
}

function toBool(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function cleanPlace(place) {
  return {
    id: String(place.id || "").trim(),
    name: String(place.name || "").trim(),
    cost: String(place.cost || "Under Rs 500").trim(),
    note: String(place.note || "").trim(),
    visited: Boolean(place.visited),
    custom: Boolean(place.custom) || String(place.id || "").startsWith("custom-"),
  };
}

function mergeDefaultPlaces(places) {
  const normalizedPlaces = places.map(cleanPlace);
  const placesById = new Map(normalizedPlaces.map((place) => [place.id, place]));
  const defaultIds = new Set(DEFAULT_PLACES.map((place) => place.id));
  const defaultPlaces = DEFAULT_PLACES.map((place) => ({ ...place, visited: Boolean(placesById.get(place.id)?.visited) }));
  const customPlaces = normalizedPlaces.filter((place) => place.custom && !defaultIds.has(place.id));

  return [...defaultPlaces, ...customPlaces];
}
function rowsToPlaces(rows) {
  return rows.map((row) => cleanPlace({ id: row[0], name: row[1], cost: row[2], note: row[3], visited: toBool(row[4]), custom: toBool(row[5]) })).filter((place) => place.id && place.name);
}

function placesToRows(places) {
  return places.map(cleanPlace).filter((place) => place.id && place.name).map((place) => [place.id, place.name, place.cost, place.note, place.visited ? "TRUE" : "FALSE", place.custom ? "TRUE" : "FALSE"]);
}

async function readFromSheetsApi() {
  const sheetTitle = await getSheetTitle();
  const range = `${quoteSheetName(sheetTitle)}!A:F`;
  const data = await sheetsRequest(`/values/${encodeURIComponent(range)}`);
  const values = data.values || [];
  const hasHeaders = HEADERS.every((header, index) => values[0]?.[index] === header);
  const places = rowsToPlaces(hasHeaders ? values.slice(1) : values);

  if (!hasHeaders || values.length <= 1 || places.length === 0) {
    await writePlacesToSheetsApi(DEFAULT_PLACES);
    return { places: DEFAULT_PLACES };
  }

  const mergedPlaces = mergeDefaultPlaces(places);

  if (JSON.stringify(placesToRows(mergedPlaces)) !== JSON.stringify(placesToRows(places))) {
    await writePlacesToSheetsApi(mergedPlaces);
  }

  return { places: mergedPlaces };
}

async function writePlacesToSheetsApi(places) {
  const sheetTitle = await getSheetTitle();
  const range = `${quoteSheetName(sheetTitle)}!A:F`;
  const rows = placesToRows(places);

  await sheetsRequest(`/values/${encodeURIComponent(range)}:clear`, { method: "POST", body: JSON.stringify({}) });
  await sheetsRequest(`/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, { method: "PUT", body: JSON.stringify({ values: [HEADERS, ...rows] }) });

  return { places: rowsToPlaces(rows) };
}

function parseCsv(csvText) {
  const rows = csvText.split(/\r?\n/).map((line) => line.split(",").map((cell) => cell.trim())).filter((row) => row.some(Boolean));
  const hasHeaders = HEADERS.every((header, index) => rows[0]?.[index] === header);
  return { places: rowsToPlaces(hasHeaders ? rows.slice(1) : rows) };
}

async function readFromCsv() {
  if (!CSV_URL) {
    return { places: DEFAULT_PLACES };
  }

  const sheetResponse = await fetch(CSV_URL.replace(/\\&/g, "&").trim());

  if (!sheetResponse.ok) {
    return { places: DEFAULT_PLACES };
  }

  const data = parseCsv(await sheetResponse.text());
  return data.places.length ? { places: mergeDefaultPlaces(data.places) } : { places: DEFAULT_PLACES };
}

async function readPlaces() {
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
      response.status(200).json(await readPlaces());
      return;
    }

    if (request.method === "PUT") {
      assertUpdatePin(request);
      response.status(200).json(await writePlacesToSheetsApi((await readJsonBody(request)).places || []));
      return;
    }

    response.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message || "Visiting places request failed" });
  }
}