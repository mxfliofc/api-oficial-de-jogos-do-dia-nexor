import {
  mkdir,
  writeFile,
  readdir,
  unlink
} from 'node:fs/promises';

const API_BASE = 'https://api.sportmonks.com/v3/football';
const TOKEN = process.env.SPORTMONKS_API_TOKEN;

const TIMEZONE = process.env.GAMES_TIMEZONE || 'America/Sao_Paulo';

const OUTPUT_FILE = 'public/games.json';
const LOGOS_DIR = 'public/logos';

if (!TOKEN) {
  throw new Error(
    'SPORTMONKS_API_TOKEN não foi configurado.'
  );
}

await mkdir('public', { recursive: true });
await mkdir(LOGOS_DIR, { recursive: true });

function getBrazilDate() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  return formatter.format(new Date());
}

function toBrazilDateTime(dateString) {
  if (!dateString) return null;

  const value = String(dateString).trim();

  if (value.includes('T')) {
    return value;
  }

  return value.replace(' ', 'T') + '-03:00';
}

function findParticipant(participants, location) {
  if (!Array.isArray(participants)) return null;

  return participants.find(
    participant =>
      participant.meta?.location === location ||
      participant.location === location
  ) || null;
}

function participantLogo(participant) {
  if (!participant) return null;

  return (
    participant.image_path ||
    participant.logo ||
    participant.logo_path ||
    null
  );
}

function participantId(participant) {
  return participant?.id ?? null;
}

function participantName(participant) {
  return participant?.name ?? null;
}

function participantShortCode(participant) {
  return (
    participant?.short_code ||
    participant?.shortCode ||
    participant?.code ||
    null
  );
}

function scoreForParticipant(scores, participantIdValue, description) {
  if (!Array.isArray(scores)) return null;

  const score = scores.find(item => {
    if (item.participant_id !== participantIdValue) {
      return false;
    }

    if (!description) {
      return true;
    }

    return (
      item.description === description ||
      item.type?.developer_name === description ||
      item.type?.name === description
    );
  });

  if (!score) return null;

  if (score.score && typeof score.score === 'object') {
    return (
      score.score.goals ??
      score.score.score ??
      score.score.value ??
      null
    );
  }

  return score.score ?? null;
}

function scoreByDescription(scores, participantIdValue, descriptions) {
  for (const description of descriptions) {
    const value = scoreForParticipant(
      scores,
      participantIdValue,
      description
    );

    if (value !== null && value !== undefined) {
      return value;
    }
  }

  return null;
}

function extractScoreSet(fixture, homeId, awayId) {
  const scores = Array.isArray(fixture.scores)
    ? fixture.scores
    : [];

  const get = (participantIdValue, descriptions) =>
    scoreByDescription(
      scores,
      participantIdValue,
      descriptions
    );

  return {
    current_home: get(homeId, [
      'CURRENT',
      'current'
    ]),

    current_away: get(awayId, [
      'CURRENT',
      'current'
    ]),

    halftime_home: get(homeId, [
      '1ST_HALF',
      '1st_half',
      'HT',
      'halftime'
    ]),

    halftime_away: get(awayId, [
      '1ST_HALF',
      '1st_half',
      'HT',
      'halftime'
    ]),

    fulltime_home: get(homeId, [
      '2ND_HALF',
      '2nd_half',
      'FT',
      'fulltime'
    ]),

    fulltime_away: get(awayId, [
      '2ND_HALF',
      '2nd_half',
      'FT',
      'fulltime'
    ]),

    extratime_home: get(homeId, [
      'EXTRA_TIME',
      'extra_time',
      'ET',
      'extratime'
    ]),

    extratime_away: get(awayId, [
      'EXTRA_TIME',
      'extra_time',
      'ET',
      'extratime'
    ]),

    penalty_home: get(homeId, [
      'PENALTY_SHOOTOUT',
      'penalty_shootout',
      'PENALTIES',
      'penalties'
    ]),

    penalty_away: get(awayId, [
      'PENALTY_SHOOTOUT',
      'penalty_shootout',
      'PENALTIES',
      'penalties'
    ])
  };
}

function stateName(state) {
  if (!state) return null;

  return (
    state.name ||
    state.short_name ||
    state.developer_name ||
    null
  );
}

function stateShort(state) {
  if (!state) return null;

  return (
    state.short_name ||
    state.developer_name ||
    state.name ||
    null
  );
}

function extractReferee(fixture) {
  if (!Array.isArray(fixture.referees)) {
    return {
      id: null,
      name: null
    };
  }

  const referee =
    fixture.referees.find(
      item =>
        item.type_id === 1 ||
        item.type === 'referee' ||
        item.type?.developer_name === 'REFEREE'
    ) ||
    fixture.referees[0];

  return {
    id: referee?.referee_id ??
      referee?.id ??
      referee?.referee?.id ??
      null,

    name: referee?.referee?.name ??
      referee?.name ??
      null
  };
}

function logoIdFromParticipant(participant) {
  return participant?.id ?? null;
}

async function downloadLogo(url, participantIdValue) {
  if (!url || !participantIdValue) {
    return null;
  }

  const filePath =
    `${LOGOS_DIR}/${participantIdValue}.png`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(
        `Logo ${participantIdValue}: HTTP ${response.status}`
      );

      return null;
    }

    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    if (buffer.length === 0) {
      return null;
    }

    await writeFile(filePath, buffer);

    return `/logos/${participantIdValue}.png`;
  } catch (error) {
    console.warn(
      `Erro ao baixar logo ${participantIdValue}:`,
      error.message
    );

    return null;
  }
}

async function cleanupLogos(validIds) {
  const files = await readdir(LOGOS_DIR);

  const valid = new Set(
    [...validIds].map(String)
  );

  for (const file of files) {
    if (!file.endsWith('.png')) continue;

    const id = file.replace('.png', '');

    if (!valid.has(id)) {
      await unlink(
        `${LOGOS_DIR}/${file}`
      );

      console.log(
        `Logo removida: ${file}`
      );
    }
  }
}

function flattenFixture(fixture) {
  const participants =
    fixture.participants || [];

  const home =
    findParticipant(
      participants,
      'home'
    ) ||
    participants[0] ||
    null;

  const away =
    findParticipant(
      participants,
      'away'
    ) ||
    participants[1] ||
    null;

  const homeId =
    participantId(home);

  const awayId =
    participantId(away);

  const scores =
    extractScoreSet(
      fixture,
      homeId,
      awayId
    );

  const referee =
    extractReferee(fixture);

  const currentHome =
    scores.current_home ??
    fixture.scores?.find(
      s =>
        s.participant_id === homeId
    )?.score?.goals ??
    0;

  const currentAway =
    scores.current_away ??
    fixture.scores?.find(
      s =>
        s.participant_id === awayId
    )?.score?.goals ??
    0;

  return {
    id: fixture.id,

    name: fixture.name,

    date: fixture.starting_at
      ? fixture.starting_at.slice(0, 10)
      : null,

    kickoff: toBrazilDateTime(
      fixture.starting_at
    ),

    kickoff_timestamp:
      fixture.starting_at_timestamp ??
      null,

    timezone: TIMEZONE,

    sport_id:
      fixture.sport_id ?? 1,

    state_id:
      fixture.state_id ?? null,

    status:
      stateShort(fixture.state),

    status_name:
      stateName(fixture.state),

    status_id:
      fixture.state?.id ??
      fixture.state_id ??
      null,

    minute:
      fixture.state?.minutes ??
      fixture.minute ??
      null,

    length:
      fixture.length ??
      null,

    result_info:
      fixture.result_info ??
      null,

    details:
      fixture.details ??
      null,

    leg:
      fixture.leg ??
      null,

    placeholder:
      fixture.placeholder ??
      false,

    last_processed_at:
      fixture.last_processed_at ??
      null,

    home_id: homeId,

    home_name:
      participantName(home),

    home_short_code:
      participantShortCode(home),

    home_logo:
      homeId
        ? `/logos/${homeId}.png`
        : participantLogo(home),

    home_meta:
      home?.meta ??
      null,

    away_id: awayId,

    away_name:
      participantName(away),

    away_short_code:
      participantShortCode(away),

    away_logo:
      awayId
        ? `/logos/${awayId}.png`
        : participantLogo(away),

    away_meta:
      away?.meta ??
      null,

    score_home:
      currentHome,

    score_away:
      currentAway,

    halftime_home:
      scores.halftime_home,

    halftime_away:
      scores.halftime_away,

    fulltime_home:
      scores.fulltime_home,

    fulltime_away:
      scores.fulltime_away,

    extratime_home:
      scores.extratime_home,

    extratime_away:
      scores.extratime_away,

    penalty_home:
      scores.penalty_home,

    penalty_away:
      scores.penalty_away,

    competition_id:
      fixture.league_id ??
      fixture.league?.id ??
      null,

    competition_name:
      fixture.league?.name ??
      null,

    competition_short_code:
      fixture.league?.short_code ??
      null,

    competition_image:
      fixture.league?.image_path ??
      null,

    season_id:
      fixture.season_id ??
      fixture.season?.id ??
      null,

    season_name:
      fixture.season?.name ??
      null,

    stage_id:
      fixture.stage_id ??
      fixture.stage?.id ??
      null,

    stage_name:
      fixture.stage?.name ??
      null,

    round_id:
      fixture.round_id ??
      fixture.round?.id ??
      null,

    round_name:
      fixture.round?.name ??
      null,

    group_id:
      fixture.group_id ??
      fixture.group?.id ??
      null,

    group_name:
      fixture.group?.name ??
      null,

    aggregate_id:
      fixture.aggregate_id ??
      fixture.aggregate?.id ??
      null,

    venue_id:
      fixture.venue_id ??
      fixture.venue?.id ??
      null,

    venue_name:
      fixture.venue?.name ??
      null,

    venue_city:
      fixture.venue?.city_name ??
      fixture.venue?.city ??
      null,

    venue_address:
      fixture.venue?.address ??
      null,

    venue_capacity:
      fixture.venue?.capacity ??
      null,

    referee_id:
      referee.id,

    referee_name:
      referee.name,

    fixture_periods:
      fixture.periods ??
      [],

    current_period:
      fixture.currentPeriod ??
      null,

    broadcasts:
      fixture.tvStations ??
      [],

    coaches:
      fixture.coaches ??
      [],

    formations:
      fixture.formations ??
      [],

    events:
      fixture.events ??
      [],

    lineups:
      fixture.lineups ??
      [],

    statistics:
      fixture.statistics ??
      [],

    xg:
      fixture.xGFixture ??
      [],

    metadata:
      fixture.metadata ??
      null,

    weather:
      fixture.weatherReport ??
      null,

    trends:
      fixture.trends ??
      [],

    pressure:
      fixture.pressure ??
      [],

    source:
      'sportmonks',

    source_name:
      'Sportmonks',

    updated_at:
      new Date().toISOString()
  };
}

async function fetchPage(date, page) {
  const includes = [
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
    'xGFixture',
    'metadata',
    'weatherReport',
    'periods',
    'currentPeriod',
    'tvStations'
  ].join(';');

  const url =
    `${API_BASE}/fixtures/date/${date}` +
    `?api_token=${encodeURIComponent(TOKEN)}` +
    `&timezone=${encodeURIComponent(TIMEZONE)}` +
    `&per_page=50` +
    `&page=${page}` +
    `&include=${encodeURIComponent(includes)}`;

  console.log(
    `Buscando página ${page}: ${date}`
  );

  const response = await fetch(url);

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

  if (json.message && !json.data) {
    throw new Error(
      `Sportmonks: ${json.message}`
    );
  }

  return json;
}

async function fetchAllFixtures(date) {
  const fixtures = [];

  let page = 1;

  while (true) {
    const response =
      await fetchPage(
        date,
        page
      );

    const data =
      Array.isArray(response.data)
        ? response.data
        : [];

    fixtures.push(...data);

    const hasMore =
      response.pagination?.has_more ??
      false;

    if (!hasMore) {
      break;
    }

    page++;

    if (page > 100) {
      throw new Error(
        'Paginação excedeu 100 páginas.'
      );
    }
  }

  return fixtures;
}

const date = getBrazilDate();

console.log(
  `Data NEXOR: ${date}`
);

const fixtures =
  await fetchAllFixtures(date);

console.log(
  `Partidas recebidas: ${fixtures.length}`
);

const games =
  fixtures
    .map(flattenFixture)
    .sort(
      (a, b) =>
        (a.kickoff_timestamp || 0) -
        (b.kickoff_timestamp || 0)
    );

const validLogoIds =
  new Set();

for (const fixture of fixtures) {
  for (const participant of
    fixture.participants || []) {

    if (participant?.id) {
      validLogoIds.add(
        participant.id
      );

      const logo =
        participantLogo(
          participant
        );

      if (logo) {
        await downloadLogo(
          logo,
          participant.id
        );
      }
    }
  }
}

await cleanupLogos(
  validLogoIds
);

const output = {
  generated_at:
    new Date().toISOString(),

  date,

  timezone:
    TIMEZONE,

  source:
    'Sportmonks',

  total:
    games.length,

  games
};

await writeFile(
  OUTPUT_FILE,
  JSON.stringify(
    games,
    null,
    2
  ) + '\n',
  'utf8'
);

await writeFile(
  'public/data-meta.json',
  JSON.stringify(
    output,
    null,
    2
  ) + '\n',
  'utf8'
);

console.log(
  `games.json atualizado com ${games.length} jogos.`
);
