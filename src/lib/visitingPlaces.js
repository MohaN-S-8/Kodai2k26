const VISITING_PLACES_API_URL = import.meta.env.VITE_VISITING_PLACES_API_URL;

async function readJsonResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 404 && VISITING_PLACES_API_URL === "/api/visiting-places") {
      throw new Error("Local visiting updates need Vercel dev. Stop npm run dev and run: npx vercel dev");
    }

    throw new Error(data.error || `Request failed with ${response.status}`);
  }

  return data;
}

export async function fetchVisitingPlaces() {
  if (!VISITING_PLACES_API_URL) {
    throw new Error("Missing VITE_VISITING_PLACES_API_URL environment variable");
  }

  const response = await fetch(VISITING_PLACES_API_URL);
  return readJsonResponse(response);
}

export async function saveVisitingPlaces({ places, pin }) {
  if (!VISITING_PLACES_API_URL) {
    throw new Error("Visiting places updates need VITE_VISITING_PLACES_API_URL=/api/visiting-places");
  }

  const response = await fetch(VISITING_PLACES_API_URL, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Trip-Update-Pin": pin,
    },
    body: JSON.stringify({ places }),
  });

  return readJsonResponse(response);
}
