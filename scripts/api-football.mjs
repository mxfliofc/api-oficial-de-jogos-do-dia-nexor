const API_BASE = "https://v3.football.api-sports.io";

function getKey() {
  const key = process.env.API_FOOTBALL_KEY;

  if (!key) {
    throw new Error(
      "API_FOOTBALL_KEY não configurada."
    );
  }

  return key;
}

export async function apiFootball(endpoint) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "x-apisports-key": getKey()
    }
  });

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `API-Football retornou resposta inválida: HTTP ${response.status}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `API-Football HTTP ${response.status}: ${
        data?.message || JSON.stringify(data)
      }`
    );
  }

  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(
      `API-Football erro: ${JSON.stringify(data.errors)}`
    );
  }

  return data;
}

export async function getFixturesByDate(date) {
  return apiFootball(
    `/fixtures?date=${encodeURIComponent(date)}`
  );
}

export async function getFixturesByIds(ids) {
  if (!ids.length) {
    return { response: [] };
  }

  const uniqueIds = [...new Set(ids)];

  return apiFootball(
    `/fixtures?ids=${uniqueIds.join("-")}`
  );
}

export async function getLiveFixtures() {
  return apiFootball("/fixtures?live=all");
}
