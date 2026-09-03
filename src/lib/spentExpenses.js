const SPENT_EXPENSES_API_URL = import.meta.env.VITE_SPENT_EXPENSES_API_URL;

function withCacheBust(url) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}_=${Date.now()}`;
}

async function readJsonResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 404 && SPENT_EXPENSES_API_URL === "/api/spent-expenses") {
      throw new Error("Local spent updates need Vercel dev. Stop npm run dev and run: npx vercel dev");
    }

    throw new Error(data.error || `Request failed with ${response.status}`);
  }

  return data;
}

export async function fetchSpentExpenses() {
  if (!SPENT_EXPENSES_API_URL) {
    throw new Error("Missing VITE_SPENT_EXPENSES_API_URL environment variable");
  }

  const response = await fetch(withCacheBust(SPENT_EXPENSES_API_URL), {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
    },
  });

  return readJsonResponse(response);
}

export async function addSpentExpense({ expense, pin }) {
  if (!SPENT_EXPENSES_API_URL) {
    throw new Error("Spent expense updates need VITE_SPENT_EXPENSES_API_URL=/api/spent-expenses");
  }

  const response = await fetch(SPENT_EXPENSES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Trip-Update-Pin": pin,
    },
    body: JSON.stringify({ expense }),
  });

  return readJsonResponse(response);
}
