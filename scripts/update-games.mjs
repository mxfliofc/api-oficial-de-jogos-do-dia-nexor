import fs from "node:fs/promises";
import {
  getFixturesByDate,
  getFixturesByIds
} from "./api-football.mjs";
import { normalizeFixture } from "./normalize.mjs";

const TIMEZONE = "America/Sao_Paulo";

function getDateInBrazil() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function chunk(array, size) {
  const result = [];

  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }

  return result;
}

async function main() {
  const date = getDateInBrazil();

  console.log(`Data NEXOR: ${date}`);
  console.log(`Timezone: ${TIMEZONE}`);
  console.log("Buscando jogos do dia...");

  const base = await getFixturesByDate(date);
  const fixtures = base.response || [];

  console.log(`Jogos encontrados: ${fixtures.length}`);

  if (!fixtures.length) {
    await fs.writeFile(
      "public/games.json",
      "[]\n",
      "utf8"
    );

    return;
  }

  const ids = fixtures
    .map((item) => item.fixture?.id)
    .filter(Boolean);

  const details = [];

  for (const batch of chunk(ids, 20)) {
    console.log(
      `Buscando detalhes: ${batch.length} jogos`
    );

    const data = await getFixturesByIds(batch);

    details.push(...(data.response || []));
  }

  const games = details
    .map(normalizeFixture)
    .sort((a, b) => {
      return (a.kickoff || "").localeCompare(
        b.kickoff || ""
      );
    });

  await fs.mkdir("public", { recursive: true });

  await fs.writeFile(
    "public/games.json",
    `${JSON.stringify(games, null, 2)}\n`,
    "utf8"
  );

  await fs.writeFile(
    "public/data-meta.json",
    `${JSON.stringify(
      {
        source: "API-Football",
        updated_at: new Date().toISOString(),
        date,
        timezone: TIMEZONE,
        games: games.length
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  console.log(
    `NEXOR atualizado: ${games.length} jogos`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
