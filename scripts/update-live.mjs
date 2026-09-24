import fs from "node:fs/promises";
import {
  getLiveFixtures
} from "./api-football.mjs";
import { normalizeFixture } from "./normalize.mjs";

const TIMEZONE = "America/Sao_Paulo";

async function main() {
  console.log("Buscando jogos ao vivo...");

  const data = await getLiveFixtures();

  const games = (data.response || [])
    .map(normalizeFixture)
    .sort((a, b) => {
      return (a.kickoff || "").localeCompare(
        b.kickoff || ""
      );
    });

  await fs.mkdir("public", { recursive: true });

  await fs.writeFile(
    "public/live.json",
    `${JSON.stringify(games, null, 2)}\n`,
    "utf8"
  );

  await fs.writeFile(
    "public/live-meta.json",
    `${JSON.stringify(
      {
        source: "API-Football",
        updated_at: new Date().toISOString(),
        timezone: TIMEZONE,
        games: games.length
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  console.log(
    `Jogos ao vivo: ${games.length}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
