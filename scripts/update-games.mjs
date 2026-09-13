import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const output = resolve('public/games.json');
const timezone = process.env.GAMES_TIMEZONE || 'America/Sao_Paulo';
const rapidApiKey = process.env.RAPIDAPI_KEY;
if (!rapidApiKey) throw new Error('RAPIDAPI_KEY não configurada nos Secrets do GitHub.');
const date = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dateForProvider = date.replaceAll('-', '');

function value(object, paths) {
  for (const path of paths) {
    const found = path.split('.').reduce((current, key) => current?.[key], object);
    if (found !== undefined && found !== null && found !== '') return found;
  }
  return null;
}
const text = (input) => input === null || input === undefined ? null : String(input).replace(/\s+/g, ' ').trim() || null;
function kickoff(match) {
  const timestamp = value(match, ['startTimestamp', 'start_timestamp', 'timestamp']);
  if (typeof timestamp === 'number' || /^\d{10}$/.test(String(timestamp || ''))) return new Date(Number(timestamp) * 1000).toISOString();
  return text(value(match, ['startTime', 'start_time', 'kickoff', 'dateTime', 'datetime', 'date']));
}
function matches(body) {
  return [body, body.response, body.data, body.matches, body.events, body.result?.matches, body.result?.data].find(Array.isArray) || [];
}
function normalize(match, index) {
  const homeName = text(value(match, ['homeTeam.name', 'home_team.name', 'home.name', 'team1.name', 'homeTeamName', 'home_team_name']));
  const awayName = text(value(match, ['awayTeam.name', 'away_team.name', 'away.name', 'team2.name', 'awayTeamName', 'away_team_name']));
  if (!homeName || !awayName) return null;
  const channels = value(match, ['broadcasts', 'channels', 'tvChannels', 'tv_channels']) || [];
  return {
    id: `rapidapi:${value(match, ['id', 'matchId', 'match_id', 'eventId', 'event_id']) || index}`,
    date, kickoff: kickoff(match), timezone,
    status: text(value(match, ['status.type', 'status.description', 'status', 'state'])) || 'scheduled',
    home: { name: homeName, logo: text(value(match, ['homeTeam.logo', 'home_team.logo', 'home.logo'])) },
    away: { name: awayName, logo: text(value(match, ['awayTeam.logo', 'away_team.logo', 'away.logo'])) },
    score: { home: value(match, ['homeScore.current', 'home_score', 'score.home', 'goals.home']), away: value(match, ['awayScore.current', 'away_score', 'score.away', 'goals.away']) },
    competition: { name: text(value(match, ['tournament.name', 'league.name', 'competition.name', 'league_name'])), country: text(value(match, ['tournament.category.name', 'league.country', 'country.name', 'country'])) },
    venue: { name: text(value(match, ['venue.name', 'stadium.name', 'ground.name'])), city: text(value(match, ['venue.city.name', 'venue.city', 'stadium.city'])) },
    broadcasts: Array.isArray(channels) ? channels.map((channel) => text(channel.name || channel)).filter(Boolean) : [],
    source: { name: 'Free API Live Football Data via RapidAPI' }
  };
}

const response = await fetch(`https://free-api-live-football-data.p.rapidapi.com/football-get-matches-by-date?date=${dateForProvider}`, {
  headers: { 'Content-Type': 'application/json', 'x-rapidapi-host': 'free-api-live-football-data.p.rapidapi.com', 'x-rapidapi-key': rapidApiKey }
});
if (!response.ok) throw new Error(`RapidAPI retornou ${response.status}: ${await response.text()}`);
const body = await response.json();
const games = matches(body).map(normalize).filter(Boolean).sort((a, b) => String(a.kickoff).localeCompare(String(b.kickoff)));
if (games.length === 0) throw new Error('A fonte respondeu, mas sem partidas reconhecíveis. Envie o JSON de exemplo da RapidAPI para ajustar o formato.');
const document = { schemaVersion: 2, date, timezone, updatedAt: new Date().toISOString(), source: 'Free API Live Football Data via RapidAPI', limitations: [], games };
await mkdir(dirname(output), { recursive: true });
const temporary = `${output}.tmp`;
await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`);
await rename(temporary, output);
console.log(`${games.length} jogos de ${date} gravados em public/games.json`);
