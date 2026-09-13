import { readFile } from 'node:fs/promises';

const file = JSON.parse(await readFile('public/games.json', 'utf8'));
if (file.schemaVersion !== 2 || !Array.isArray(file.games)) throw new Error('Formato inválido de games.json');
for (const game of file.games) {
  for (const field of ['id', 'date', 'kickoff', 'home', 'away', 'competition', 'venue', 'broadcasts']) {
    if (!(field in game)) throw new Error(`Jogo ${game.id}: campo ausente ${field}`);
  }
}
console.log(`games.json válido: ${file.games.length} jogos.`);
