import fs from 'node:fs/promises';
import path from 'node:path';

const API_BASE = 'https://api.sportmonks.com/v3/football';
const TOKEN = process.env.SPORTMONKS_API_TOKEN;

const TIMEZONE =
  process.env.GAMES_TIMEZONE ||
  'America/Sao_Paulo';

const OUTPUT_FILE =
  path.resolve('public/live.json');

const META_FILE =
  path.resolve('public/live-meta.json');

if (!TOKEN) {
  throw new Error(
    'SPORTMONKS_API_TOKEN não foi configurado nas Secrets do GitHub.'
  );
}

const INCLUDE_LIST = [
  'participants',
  'scores',
  'state',
  'league',
  'season',
  'round',
  'stage',
  'venue',
  'events',
  'lineups.player',
  'lineups.details.type',
  'statistics.type',
  'formations',
  'referees',
  'coaches',
  'periods',
  'currentPeriod',
  'tvStations'
];

const INCLUDES = INCLUDE_LIST.join(';');

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberOrNull(value) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  const n = Number(value);

  return Number.isFinite(n) ? n : null;
}

function getParticipant(fixture, location) {
  const participants =
    safeArray(fixture.participants);

  return (
    participants.find(
      (p) =>
        p.meta?.location === location ||
        p.location === location
    ) ||
    participants.find((p) => {
      if (location === 'home') {
        return p.meta?.location === 'home';
      }

      return p.meta?.location === 'away';
    }) ||
    null
  );
}

function participantId(participant) {
  return (
    numberOrNull(participant?.id) ??
    numberOrNull(participant?.team_id) ??
    null
  );
}

function participantName(participant) {
  return (
    participant?.name ||
    participant?.short_code ||
    participant?.short_name ||
    null
  );
}

function getScore(fixture, location) {
  const scores =
    safeArray(fixture.scores);

  const current =
    scores.find(
      (score) =>
        score.description === 'CURRENT' &&
        score.participant === location
    );

  if (current) {
    return (
      numberOrNull(current.goals) ??
      numberOrNull(current.score?.goals) ??
      null
    );
  }

  const fallback =
    scores.find(
      (score) =>
        score.participant === location ||
        score.meta?.location === location
    );

  return (
    numberOrNull(fallback?.goals) ??
    numberOrNull(fallback?.score?.goals) ??
    null
  );
}

function normalizeEvent(event) {
  return {
    id: numberOrNull(event.id),
    minute: numberOrNull(event.minute),
    extra_minute:
      numberOrNull(event.extra_minute),
    type: event.type || null,
    detail: event.detail || null,

    player_id:
      numberOrNull(event.player_id) ??
      numberOrNull(event.player?.id),

    player_name:
      event.player?.name ||
      event.player?.common_name ||
      null,

    related_player_id:
      numberOrNull(event.related_player_id) ??
      numberOrNull(event.related_player?.id),

    related_player_name:
      event.related_player?.name ||
      event.related_player?.common_name ||
      null,

    participant_id:
      numberOrNull(event.participant_id) ??
      numberOrNull(event.participant?.id)
  };
}

function normalizeLineup(lineup) {
  return {
    id: numberOrNull(lineup.id),

    player_id:
      numberOrNull(lineup.player_id) ??
      numberOrNull(lineup.player?.id),

    player_name:
      lineup.player?.name ||
      lineup.player?.common_name ||
      lineup.name ||
      null,

    jersey_number:
      numberOrNull(lineup.jersey_number),

    formation_position:
      numberOrNull(lineup.formation_position),

    position_id:
      numberOrNull(lineup.position_id),

    type_id:
      numberOrNull(lineup.type_id),

    substitute:
      Boolean(lineup.substitute),

    details: safeArray(lineup.details).map(
      (detail) => ({
        id: numberOrNull(detail.id),

        type_id:
          numberOrNull(detail.type_id) ??
          numberOrNull(detail.type?.id),

        type_name:
          detail.type?.name ||
          detail.type?.developer_name ||
          null,

        value: detail.value ?? null
      })
    )
  };
}

function normalizeStatistic(statistic) {
  return {
    id: numberOrNull(statistic.id),

    participant_id:
      numberOrNull(statistic.participant_id) ??
      numberOrNull(statistic.team_id),

    type_id:
      numberOrNull(statistic.type_id) ??
      numberOrNull(statistic.type?.id),

    type_name:
      statistic.type?.name ||
      statistic.type?.developer_name ||
      statistic.name ||
      null,

    value:
      statistic.value ?? null
  };
}

function normalizeFormation(formation) {
  return {
    id: numberOrNull(formation.id),

    participant_id:
      numberOrNull(formation.participant_id) ??
      numberOrNull(formation.team_id),

    formation:
      formation.formation ||
      formation.formation_name ||
      null
  };
}

function normalizePeriod(period) {
  return {
    id: numberOrNull(period.id),
    description:
      period.description || null,
    type: period.type || null,
    started: period.started || null,
    ended: period.ended || null
  };
}

function getLogo(participant) {
  if (!participant) {
    return null;
  }

  const id = participantId(participant);

  return id
    ? `/logos/${id}.png`
    : null;
}

function normalizeFixture(fixture) {
  const home =
    getParticipant(fixture, 'home');

  const away =
    getParticipant(fixture, 'away');

  const state =
    fixture.state || {};

  const league =
    fixture.league || {};

  const season =
    fixture.season || {};

  const venue =
    fixture.venue || {};

  return {
    id: numberOrNull(fixture.id),

    source: 'sportmonks',

    kickoff:
      fixture.starting_at || null,

    timezone: TIMEZONE,

    status_id:
      numberOrNull(state.id),

    status:
      state.name || null,

    status_short:
      state.short_name ||
      state.short_code ||
      null,

    status_developer_name:
      state.developer_name ||
      null,

    home_id:
      participantId(home),

    home_name:
      participantName(home),

    home_short_code:
      home?.short_code || null,

    home_logo:
      getLogo(home),

    away_id:
      participantId(away),

    away_name:
      participantName(away),

    away_short_code:
      away?.short_code || null,

    away_logo:
      getLogo(away),

    score_home:
      getScore(fixture, 'home'),

    score_away:
      getScore(fixture, 'away'),

    competition_id:
      numberOrNull(league.id),

    competition_name:
      league.name || null,

    competition_country:
      league.country?.name ||
      league.country_name ||
      null,

    season_id:
      numberOrNull(season.id),

    season_name:
      season.name || null,

    venue_id:
      numberOrNull(venue.id),

    venue_name:
      venue.name || null,

    venue_city:
      venue.city_name ||
      venue.city ||
      null,

    events:
      safeArray(fixture.events)
        .map(normalizeEvent),

    lineups:
      safeArray(fixture.lineups)
        .map(normalizeLineup),

    statistics:
      safeArray(fixture.statistics)
        .map(normalizeStatistic),

    formations:
      safeArray(fixture.formations)
        .map(normalizeFormation),

    referees:
      safeArray(fixture.referees)
        .map((referee) => ({
          id: numberOrNull(referee.id),
          name:
            referee.common_name ||
            referee.name ||
            null,
          type:
            referee.type || null
        })),

    coaches:
      safeArray(fixture.coaches)
        .map((coach) => ({
          id: numberOrNull(coach.id),
          name:
            coach.name ||
            coach.common_name ||
            null,
          team_id:
            numberOrNull(coach.team_id) ??
            numberOrNull(coach.participant_id)
        })),

    periods:
      safeArray(fixture.periods)
        .map(normalizePeriod),

    current_period:
      fixture.currentPeriod || null,

    tv_stations:
      safeArray(fixture.tvStations)
        .map((station) => ({
          id: numberOrNull(station.id),
          name: station.name || null,
          url: station.url || null
        }))
  };
}

const url =
  new URL(`${API_BASE}/livescores/inplay`);

url.searchParams.set(
  'timezone',
  TIMEZONE
);

url.searchParams.set(
  'include',
  INCLUDES
);

console.log(
  'Buscando jogos ao vivo no Sportmonks...'
);

const response = await fetch(url, {
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/json'
  }
});

const text =
  await response.text();

if (!response.ok) {
  throw new Error(
    `Sportmonks HTTP ${response.status}: ${text}`
  );
}

let json;

try {
  json = JSON.parse(text);
} catch {
  throw new Error(
    'Resposta do Sportmonks não é JSON.'
  );
}

const fixtures =
  safeArray(json.data);

const liveGames =
  fixtures.map(normalizeFixture);

await fs.mkdir(
  path.dirname(OUTPUT_FILE),
  { recursive: true }
);

await fs.writeFile(
  OUTPUT_FILE,
  JSON.stringify(
    liveGames,
    null,
    2
  ),
  'utf8'
);

const meta = {
  source: 'sportmonks',
  generated_at:
    new Date().toISOString(),
  timezone: TIMEZONE,
  games: liveGames.length,
  xg_enabled: false,
  includes: INCLUDE_LIST
};

await fs.writeFile(
  META_FILE,
  JSON.stringify(
    meta,
    null,
    2
  ),
  'utf8'
);

console.log('');
console.log(
  `Jogos ao vivo: ${liveGames.length}`
);
console.log(
  `Arquivo: ${OUTPUT_FILE}`
);
console.log(
  'xGFixture: DESATIVADO'
);
