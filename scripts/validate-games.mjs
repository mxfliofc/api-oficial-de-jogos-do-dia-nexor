import { readFile } from 'node:fs/promises';

const file = JSON.parse(
  await readFile('public/games.json', 'utf8')
);

if (!Array.isArray(file)) {
  throw new Error(
    'Formato inválido: games.json deve ser um array.'
  );
}

for (const game of file) {

  for (const field of [
    'id',
    'date',
    'kickoff',
    'home',
    'away',
    'competition',
    'venue',
    'broadcasts'
  ]) {

    if (!(field in game)) {
      throw new Error(
        `Jogo ${game.id}: campo ausente "${field}".`
      );
    }
  }

  if (!Array.isArray(game.home)) {
    throw new Error(
      `Jogo ${game.id}: home deve ser um array.`
    );
  }

  if (!Array.isArray(game.away)) {
    throw new Error(
      `Jogo ${game.id}: away deve ser um array.`
    );
  }

  if (game.home.length === 0) {
    throw new Error(
      `Jogo ${game.id}: home está vazio.`
    );
  }

  if (game.away.length === 0) {
    throw new Error(
      `Jogo ${game.id}: away está vazio.`
    );
  }
}

console.log(
  `games.json válido: ${file.length} jogos.`
);
