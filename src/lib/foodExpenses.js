const FOOD_EXPENSES_API_URL = import.meta.env.VITE_FOOD_EXPENSES_API_URL;

function withCacheBust(url) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}_=${Date.now()}`;
}

async function readJsonResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 404 && FOOD_EXPENSES_API_URL === "/api/food-expenses") {
      throw new Error("Local food updates need Vercel dev. Stop npm run dev and run: npx vercel dev");
    }

    throw new Error(data.error || `Request failed with ${response.status}`);
  }

  return data;
}

export async function fetchFoodExpenses() {
  if (!FOOD_EXPENSES_API_URL) {
    throw new Error("Missing VITE_FOOD_EXPENSES_API_URL environment variable");
  }

  const response = await fetch(withCacheBust(FOOD_EXPENSES_API_URL), {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
    },
  });
  return readJsonResponse(response);
}

export async function saveFoodExpenses({ expenses, pin }) {
  if (!FOOD_EXPENSES_API_URL) {
    throw new Error("Food expense updates need VITE_FOOD_EXPENSES_API_URL=/api/food-expenses");
  }

  const response = await fetch(FOOD_EXPENSES_API_URL, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Trip-Update-Pin": pin,
    },
    body: JSON.stringify({ expenses }),
  });

  return readJsonResponse(response);
}
