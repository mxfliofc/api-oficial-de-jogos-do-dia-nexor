import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const output = resolve('public/games.json');
const timezone = process.env.GAMES_TIMEZONE || 'America/Sao_Paulo';
const key = process.env.RAPIDAPI_KEY;
if (!key) throw new Error('RAPIDAPI_KEY não configurada nos Secrets do GitHub.');
const date = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const compactDate = date.replaceAll('-', '');
const text = (input) => input === null || input === undefined ? null : String(input).replace(/\s+/g, ' ').trim() || null;

function get(object, paths) {
  for (const path of paths) {
    const found = path.split('.').reduce((current, part) => current?.[part], object);
    if (found !== undefined && found !== null && found !== '') return found;
  }
  return null;
}
function kickoff(match) {
  if (match.timeTS) return new Date(Number(match.timeTS)).toISOString();
  return text(get(match, ['status.utcTime', 'startTime', 'date']));
}
function normalize(match, index) {
  const home = text(get(match, ['home.name']));
  const away = text(get(match, ['away.name']));
  if (!home || !away) return null;
  return {
    id: `rapidapi:${match.id || index}`, date, kickoff: kickoff(match), timezone,
    status: text(get(match, ['status.reason.short', 'status.reason.long'])) || 'scheduled',
    home: { id: text(match.home?.id), name: home },
    away: { id: text(match.away?.id), name: away },
    score: { home: match.home?.score ?? null, away: match.away?.score ?? null },
    competition: { id: text(match.leagueId), name: null, country: null },
    venue: { name: null, city: null }, broadcasts: [],
    source: { name: 'Free API Live Football Data via RapidAPI' }
  };
}

const response = await fetch(`https://free-api-live-football-data.p.rapidapi.com/football-get-matches-by-date?date=${compactDate}`, {
  headers: { 'Content-Type': 'application/json', 'x-rapidapi-host': 'free-api-live-football-data.p.rapidapi.com', 'x-rapidapi-key': key }
});
if (!response.ok) throw new Error(`RapidAPI retornou ${response.status}: ${await response.text()}`);
const body = await response.json();
const games = (body.response?.matches || []).map(normalize).filter(Boolean).sort((a, b) => a.kickoff.localeCompare(b.kickoff));
if (!games.length) throw new Error('A fonte respondeu, mas não retornou jogos para esta data.');
const data = { schemaVersion: 2, date, timezone, updatedAt: new Date().toISOString(), source: 'Free API Live Football Data via RapidAPI', limitations: ['Esta rota fornece o ID da competição; nome, estádio e transmissão exigem rotas adicionais da fonte.'], games };
await mkdir(dirname(output), { recursive: true });
const temporary = `${output}.tmp`;
await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`);
await rename(temporary, output);
console.log(`${games.length} jogos de ${date} gravados em public/games.json`);
