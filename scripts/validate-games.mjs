import fs from "node:fs/promises";

const file = "public/games.json";

const required = [
  "id",
  "date",
  "kickoff",
  "timezone",
  "status",
  "status_short",
  "home_id",
  "home_name",
  "home_logo",
  "away_id",
  "away_name",
  "away_logo",
  "score_home",
  "score_away",
  "competition_id",
  "competition_name",
  "events",
  "lineups",
  "statistics",
  "players"
];

async function main() {
  const content = await fs.readFile(file, "utf8");
  const games = JSON.parse(content);

  if (!Array.isArray(games)) {
    throw new Error(
      "games.json precisa ser um array."
    );
  }

  const ids = new Set();

  for (const game of games) {
    for (const field of required) {
      if (!(field in game)) {
        throw new Error(
          `Jogo ${game.id}: campo ausente: ${field}`
        );
      }
    }

    if (ids.has(game.id)) {
      throw new Error(
        `ID duplicado: ${game.id}`
      );
    }

    ids.add(game.id);

    if (!Array.isArray(game.events)) {
      throw new Error(
        `Jogo ${game.id}: events precisa ser array`
      );
    }

    if (!Array.isArray(game.lineups)) {
      throw new Error(
        `Jogo ${game.id}: lineups precisa ser array`
      );
    }

    if (!Array.isArray(game.statistics)) {
      throw new Error(
        `Jogo ${game.id}: statistics precisa ser array`
      );
    }

    if (!Array.isArray(game.players)) {
      throw new Error(
        `Jogo ${game.id}: players precisa ser array`
      );
    }
  }

  console.log(
    `Validação OK: ${games.length} jogos`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
