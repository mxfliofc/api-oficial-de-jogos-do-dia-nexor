import { readFile } from 'node:fs/promises';

const file = JSON.parse(
  await readFile(
    'public/games.json',
    'utf8'
  )
);

/* =========================================================
   games.json precisa ser um ARRAY
   ========================================================= */

if (!Array.isArray(file)) {

  throw new Error(
    'Formato inválido: games.json deve ser um array.'
  );

}

/* =========================================================
   CAMPOS PRINCIPAIS
   ========================================================= */

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
  'statusShort',
  'statusLong',

  'competition_id',
  'competition_name',

  'venue_id',
  'venue_name',
  'venue_city',

  'broadcasts',
  'source_name'
];

/* =========================================================
   VALIDAR CADA JOGO
   ========================================================= */

for (const game of file) {

  for (const field of requiredFields) {

    if (!(field in game)) {

      throw new Error(
        `Jogo ${game.id}: campo ausente "${field}".`
      );

    }

  }

  /* =======================================================
     VERIFICAR TIPOS
     ======================================================= */

  if (
    typeof game.id !== 'number'
  ) {

    throw new Error(
      `Jogo ${game.id}: id deve ser número.`
    );

  }

  if (
    typeof game.home_name !== 'string'
  ) {

    throw new Error(
      `Jogo ${game.id}: home_name deve ser texto.`
    );

  }

  if (
    typeof game.away_name !== 'string'
  ) {

    throw new Error(
      `Jogo ${game.id}: away_name deve ser texto.`
    );

  }

  if (
    !Array.isArray(game.broadcasts)
  ) {

    throw new Error(
      `Jogo ${game.id}: broadcasts deve ser array.`
    );

  }

}

/* =========================================================
   RESULTADO
   ========================================================= */

console.log(
  `games.json válido: ${file.length} jogos.`
);
