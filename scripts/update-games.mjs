import fs from 'node:fs/promises';
import path from 'node:path';

const API_BASE = 'https://api.sportmonks.com/v3/football';
const TOKEN = process.env.SPORTMONKS_API_TOKEN;

const TIMEZONE = process.env.GAMES_TIMEZONE || 'America/Sao_Paulo';

const OUTPUT_FILE = path.resolve('public/games.json');
const META_FILE = path.resolve('public/data-meta.json');
const LOGOS_DIR = path.resolve('public/logos');

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
  'group',
  'venue',
  'referees',
  'coaches',
  'formations',
  'events',
  'lineups.player',
  'lineups.details.type',
  'statistics.type',
  'metadata',
  'periods',
  'currentPeriod',
  'tvStations'
];

const INCLUDES = INCLUDE_LIST.join(';');

await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
await fs.mkdir(LOGOS_DIR, { recursive: true });

function getBrazilDate() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  return formatter.format(new Date());
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstArrayItem(value) {
  return Array.isArray(value) && value.length ? value[0] : null;
}

function cleanString(value) {
  if (value === undefined || value === null) return null;
  return String(value);
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function getParticipant(fixture, location) {
  const participants = safeArray(fixture.participants);

  return (
    participants.find(
      (participant) =>
        participant.meta?.location === location ||
        participant.location === location
    ) ||
    participants.find((participant) => {
      if (location === 'home') {
        return (
          participant.meta?.location === 'home' ||
          participant.meta?.location === 1
        );
      }

      return (
        participant.meta?.location === 'away' ||
        participant.meta?.location === 2
      );
    }) ||
    null
  );
}

function getParticipantId(participant) {
  return (
    numberOrNull(participant?.id) ??
    numberOrNull(participant?.team_id) ??
    numberOrNull(participant?.participant_id)
  );
}

function getParticipantName(participant) {
  return (
    participant?.name ||
    participant?.short_code ||
    participant?.short_name ||
    null
  );
}

function getParticipantLogo(participant) {
  return (
    participant?.image_path ||
    participant?.logo ||
    participant?.logo_path ||
    null
  );
}

function getScore(fixture, location) {
  const scores = safeArray(fixture.scores);

  const score = scores.find(
    (item) =>
      item.description === 'CURRENT' &&
      item.participant === location
  );

  if (score) {
    return (
      numberOrNull(score.goals) ??
      numberOrNull(score.score?.goals) ??
      null
    );
  }

  const fallback = scores.find(
    (item) =>
      item.participant === location ||
      item.meta?.location === location
  );

  return (
    numberOrNull(fallback?.goals) ??
    numberOrNull(fallback?.score?.goals) ??
    null
  );
}

function getState(fixture) {
  return fixture.state || {};
}

function getStatus(fixture) {
  const state = getState(fixture);

  return {
    id: numberOrNull(state.id),
    name: state.name || null,
    short: state.short_name || state.short_code || null,
    developer_name: state.developer_name || null
  };
}

function getVenue(fixture) {
  const venue = fixture.venue || {};

  return {
    id: numberOrNull(venue.id),
    name: venue.name || null,
    city: venue.city_name || venue.city || null,
    address: venue.address || null,
    capacity: numberOrNull(venue.capacity),
    image: venue.image_path || null
  };
}

function getLeague(fixture) {
  const league = fixture.league || {};

  return {
    id: numberOrNull(league.id),
    name: league.name || null,
    country: league.country?.name || league.country_name || null,
    image: league.image_path || null
  };
}

function getSeason(fixture) {
  const season = fixture.season || {};

  return {
    id: numberOrNull(season.id),
    name: season.name || null
  };
}

function getRound(fixture) {
  const round = fixture.round || {};

  return {
    id: numberOrNull(round.id),
    name: round.name || null,
    type: round.type || null
  };
}

function getStage(fixture) {
  const stage = fixture.stage || {};

  return {
    id: numberOrNull(stage.id),
    name: stage.name || null,
    type: stage.type || null
  };
}

function getGroup(fixture) {
  const group = fixture.group || {};

  return {
    id: numberOrNull(group.id),
    name: group.name || null
  };
}

function getReferees(fixture) {
  return safeArray(fixture.referees).map((referee) => ({
    id: numberOrNull(referee.id),
    name: referee.common_name || referee.name || null,
    type: referee.type || null
  }));
}

function getCoaches(fixture) {
  return safeArray(fixture.coaches).map((coach) => ({
    id: numberOrNull(coach.id),
    name: coach.name || coach.common_name || null,
    team_id:
      numberOrNull(coach.team_id) ??
      numberOrNull(coach.participant_id)
  }));
}

function getTvStations(fixture) {
  return safeArray(fixture.tvStations).map((station) => ({
    id: numberOrNull(station.id),
    name: station.name || null,
    url: station.url || null
  }));
}

function getLogoUrl(participant) {
  const url = getParticipantLogo(participant);

  if (!url || typeof url !== 'string') {
    return null;
  }

  return url;
}

async function downloadLogo(participant) {
  const id = getParticipantId(participant);
  const url = getLogoUrl(participant);

  if (!id || !url) {
    return null;
  }

  const output = path.join(LOGOS_DIR, `${id}.png`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'NEXOR/2.0'
      }
    });

    if (!response.ok) {
      console.log(
        `Logo ${id}: HTTP ${response.status}`
      );

      return `/logos/${id}.png`;
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.length > 0) {
      await fs.writeFile(output, buffer);
    }

    return `/logos/${id}.png`;
  } catch (error) {
    console.log(
      `Não foi possível baixar logo ${id}: ${error.message}`
    );

    return `/logos/${id}.png`;
  }
}

function getKickoff(fixture) {
  if (fixture.starting_at) {
    return fixture.starting_at;
  }

  if (fixture.starting_at_timestamp) {
    return new Date(
      fixture.starting_at_timestamp * 1000
    ).toISOString();
  }

  return null;
}

function normalizeEvent(event) {
  return {
    id: numberOrNull(event.id),
    minute: numberOrNull(event.minute),
    extra_minute: numberOrNull(event.extra_minute),
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
    jersey_number: numberOrNull(lineup.jersey_number),
    formation_position:
      numberOrNull(lineup.formation_position),
    position_id:
      numberOrNull(lineup.position_id),
    type_id:
      numberOrNull(lineup.type_id),
    starter: Boolean(lineup.formation_position),
    substitute: Boolean(lineup.substitute),
    details: safeArray(lineup.details).map((detail) => ({
      id: numberOrNull(detail.id),
      type_id:
        numberOrNull(detail.type_id) ??
        numberOrNull(detail.type?.id),
      type_name:
        detail.type?.name ||
        detail.type?.developer_name ||
        null,
      value: detail.value ?? null
    }))
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
    value: statistic.value ?? null
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
    description: period.description || null,
    type: period.type || null,
    started: period.started || null,
    ended: period.ended || null
  };
}

function normalizeMetadata(item) {
  if (!item || typeof item !== 'object') {
    return item;
  }

  return item;
}

async function normalizeFixture(fixture) {
  const home = getParticipant(fixture, 'home');
  const away = getParticipant(fixture, 'away');

  const homeId = getParticipantId(home);
  const awayId = getParticipantId(away);

  const [homeLogo, awayLogo] = await Promise.all([
    downloadLogo(home),
    downloadLogo(away)
  ]);

  const kickoff = getKickoff(fixture);

  const date =
    fixture.starting_at
      ? new Intl.DateTimeFormat('en-CA', {
          timeZone: TIMEZONE,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(new Date(fixture.starting_at))
      : null;

  const status = getStatus(fixture);
  const league = getLeague(fixture);
  const season = getSeason(fixture);
  const round = getRound(fixture);
  const stage = getStage(fixture);
  const group = getGroup(fixture);

  return {
    id: numberOrNull(fixture.id),

    source: 'sportmonks',
    source_id: numberOrNull(fixture.id),

    date,
    kickoff,
    timezone: TIMEZONE,

    status_id: status.id,
    status: status.name,
    status_short: status.short,
    status_developer_name: status.developer_name,

    home_id: homeId,
    home_name: getParticipantName(home),
    home_short_code: home?.short_code || null,
    home_logo: homeLogo,

    away_id: awayId,
    away_name: getParticipantName(away),
    away_short_code: away?.short_code || null,
    away_logo: awayLogo,

    score_home: getScore(fixture, 'home'),
    score_away: getScore(fixture, 'away'),

    competition_id: league.id,
    competition_name: league.name,
    competition_country: league.country,
    competition_logo: league.image,

    season_id: season.id,
    season_name: season.name,

    round_id: round.id,
    round_name: round.name,
    round_type: round.type,

    stage_id: stage.id,
    stage_name: stage.name,
    stage_type: stage.type,

    group_id: group.id,
    group_name: group.name,

    venue_id: numberOrNull(fixture.venue?.id),
    venue_name: getVenue(fixture).name,
    venue_city: getVenue(fixture).city,
    venue_address: getVenue(fixture).address,
    venue_capacity: getVenue(fixture).capacity,
    venue_image: getVenue(fixture).image,

    referee_count: safeArray(fixture.referees).length,
    coach_count: safeArray(fixture.coaches).length,

    referees: getReferees(fixture),
    coaches: getCoaches(fixture),
    formations: safeArray(fixture.formations).map(normalizeFormation),

    events: safeArray(fixture.events).map(normalizeEvent),

    lineups: safeArray(fixture.lineups).map(normalizeLineup),

    statistics: safeArray(fixture.statistics).map(normalizeStatistic),

    periods: safeArray(fixture.periods).map(normalizePeriod),

    current_period: fixture.currentPeriod || null,

    tv_stations: getTvStations(fixture),

    metadata: safeArray(fixture.metadata).map(normalizeMetadata),

    comments: safeArray(fixture.comments),

    raw_last_updated:
      fixture.updated_at ||
      fixture.updated_at_timestamp ||
      null
  };
}

async function fetchFixtures(date) {
  const fixtures = [];

  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = new URL(
      `${API_BASE}/fixtures/date/${date}`
    );

    url.searchParams.set('timezone', TIMEZONE);
    url.searchParams.set('per_page', '50');
    url.searchParams.set('page', String(page));
    url.searchParams.set('include', INCLUDES);

    console.log(
      `Buscando página ${page}: ${date}`
    );

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/json'
      }
    });

    const text = await response.text();

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
        'Sportmonks retornou uma resposta que não é JSON.'
      );
    }

    const data = safeArray(json.data);

    fixtures.push(...data);

    hasMore =
      json.pagination?.has_more === true;

    console.log(
      `Página ${page}: ${data.length} jogos`
    );

    if (hasMore) {
      page++;
    }
  }

  return fixtures;
}

async function cleanUnusedLogos(usedIds) {
  try {
    const files = await fs.readdir(LOGOS_DIR);

    for (const file of files) {
      if (!file.endsWith('.png')) continue;

      const id = path.basename(
        file,
        '.png'
      );

      if (!usedIds.has(id)) {
        await fs.unlink(
          path.join(LOGOS_DIR, file)
        );

        console.log(
          `Logo removido: ${file}`
        );
      }
    }
  } catch (error) {
    console.log(
      `Aviso ao limpar logos: ${error.message}`
    );
  }
}

const date = getBrazilDate();

console.log('');
console.log('================================');
console.log('       NEXOR DATA UPDATE');
console.log('================================');
console.log(`Data NEXOR: ${date}`);
console.log(`Timezone: ${TIMEZONE}`);
console.log('================================');
console.log('');

const fixtures = await fetchFixtures(date);

console.log('');
console.log(
  `Total de fixtures recebidas: ${fixtures.length}`
);
console.log('');

const games = [];

for (let i = 0; i < fixtures.length; i++) {
  const fixture = fixtures[i];

  console.log(
    `[${i + 1}/${fixtures.length}] Processando fixture ${fixture.id}`
  );

  try {
    const game = await normalizeFixture(fixture);

    games.push(game);
  } catch (error) {
    console.log(
      `Erro na fixture ${fixture.id}: ${error.message}`
    );
  }
}

games.sort((a, b) => {
  const dateA = a.kickoff
    ? new Date(a.kickoff).getTime()
    : Number.MAX_SAFE_INTEGER;

  const dateB = b.kickoff
    ? new Date(b.kickoff).getTime()
    : Number.MAX_SAFE_INTEGER;

  return dateA - dateB;
});

const usedLogoIds = new Set();

for (const game of games) {
  if (game.home_id) {
    usedLogoIds.add(String(game.home_id));
  }

  if (game.away_id) {
    usedLogoIds.add(String(game.away_id));
  }
}

await cleanUnusedLogos(usedLogoIds);

const output = JSON.stringify(
  games,
  null,
  2
);

await fs.writeFile(
  OUTPUT_FILE,
  output,
  'utf8'
);

const meta = {
  source: 'sportmonks',
  generated_at: new Date().toISOString(),
  date,
  timezone: TIMEZONE,
  games: games.length,
  includes: INCLUDE_LIST,
  xg_enabled: false
};

await fs.writeFile(
  META_FILE,
  JSON.stringify(meta, null, 2),
  'utf8'
);

console.log('');
console.log('================================');
console.log('       ATUALIZAÇÃO CONCLUÍDA');
console.log('================================');
console.log(`Jogos: ${games.length}`);
console.log(`Arquivo: ${OUTPUT_FILE}`);
console.log(`Meta: ${META_FILE}`);
console.log('xGFixture: DESATIVADO');
console.log('================================');
