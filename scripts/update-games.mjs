import fs from "node:fs/promises";
import {
getFixturesByDate
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

async function writeJson(file, data) {
await fs.writeFile(
file,
`${JSON.stringify(data, null, 2)}\n`,
"utf8"
);
}

async function main() {
const date = getDateInBrazil();

console.log(`Data NEXOR: ${date}`);
console.log(`Timezone: ${TIMEZONE}`);
console.log("Buscando jogos do dia...");

/*

* Plano Free:
* Não usamos /fixtures?ids=...
*
* A chamada por data já retorna todos os
* jogos disponíveis para o dia.
  */
  const data = await getFixturesByDate(date);

const fixtures = data.response || [];

console.log(`Jogos encontrados: ${fixtures.length}`);

const games = fixtures
.map(normalizeFixture)
.filter((game) => game.id !== null)
.sort((a, b) => {
return (a.kickoff || "").localeCompare(
b.kickoff || ""
);
});

await fs.mkdir("public", {
recursive: true
});

await writeJson(
"public/games.json",
games
);

await writeJson(
"public/data-meta.json",
{
source: "API-Football",
updated_at: new Date().toISOString(),
date,
timezone: TIMEZONE,
games: games.length
}
);

console.log(
`NEXOR atualizado: ${games.length} jogos`
);

console.log(
"Nenhuma chamada /fixtures?ids= foi realizada."
);
}

main().catch((error) => {
console.error(error);
process.exit(1);
});
