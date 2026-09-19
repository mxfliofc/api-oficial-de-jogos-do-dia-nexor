import { readFile } from 'node:fs/promises';

const games =
  JSON.parse(
    await readFile(
      'public/games.json',
      'utf8'
    )
  );

if (!Array.isArray(games)) {
  throw new Error(
    'games.json precisa ser um array.'
  );
}

const requiredFields = [
  'id',
  'date',
  'kickoff',
  'timezone',

  'home_id',
  'home_name',
  'home_logo',

  'away_id',
  'away_name',
  'away_logo',

  'score_home',
  'score_away',

  'status',

  'competition_id',
  'competition_name',

  'events',
  'lineups',
  'statistics',

  'source_name'
];

const ids = new Set();

for (const game of games) {
  if (!game || typeof game !== 'object') {
    throw new Error(
      'Existe um item inválido em games.json.'
    );
  }

  for (const field of requiredFields) {
    if (!(field in game)) {
      throw new Error(
        `Jogo ${game.id}: campo ausente "${field}".`
      );
    }
  }

  if (
    typeof game.id !== 'number'
  ) {
    throw new Error(
      `Jogo ${game.id}: id inválido.`
    );
  }

  if (ids.has(game.id)) {
    throw new Error(
      `ID duplicado: ${game.id}`
    );
  }

  ids.add(game.id);

  if (
    game.home_id !== null &&
    typeof game.home_id !== 'number'
  ) {
    throw new Error(
      `Jogo ${game.id}: home_id inválido.`
    );
  }

  if (
    game.away_id !== null &&
    typeof game.away_id !== 'number'
  ) {
    throw new Error(
      `Jogo ${game.id}: away_id inválido.`
    );
  }

  if (
    typeof game.home_name !== 'string' &&
    game.home_name !== null
  ) {
    throw new Error(
      `Jogo ${game.id}: home_name inválido.`
    );
  }

  if (
    typeof game.away_name !== 'string' &&
    game.away_name !== null
  ) {
    throw new Error(
      `Jogo ${game.id}: away_name inválido.`
    );
  }

  if (!Array.isArray(game.events)) {
    throw new Error(
      `Jogo ${game.id}: events deve ser array.`
    );
  }

  if (!Array.isArray(game.lineups)) {
    throw new Error(
      `Jogo ${game.id}: lineups deve ser array.`
    );
  }

  if (!Array.isArray(game.statistics)) {
    throw new Error(
      `Jogo ${game.id}: statistics deve ser array.`
    );
  }
}

console.log(
  `games.json válido: ${games.length} jogos.`
);
