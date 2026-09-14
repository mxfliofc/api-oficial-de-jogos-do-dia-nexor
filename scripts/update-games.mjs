import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const output = resolve('public/games.json');

const timezone = process.env.GAMES_TIMEZONE || 'America/Sao_Paulo';
const apiKey = process.env.API_FOOTBALL_KEY;

if (!apiKey) {
  throw new Error(
    'API_FOOTBALL_KEY não configurada nos Secrets do GitHub.'
  );
}

function getLocalDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

const date = getLocalDate();

function text(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const result = String(value)
    .replace(/\s+/g, ' ')
    .trim();

  return result || null;
}

function normalizeStatus(short, long) {
  const code = text(short);

  if (!code) {
    return 'scheduled';
  }

  if ([
    '1H',
    '2H',
    'HT',
    'ET',
    'BT',
    'P',
    'LIVE'
  ].includes(code)) {
    return 'live';
  }

  if ([
    'FT',
    'AET',
    'PEN'
  ].includes(code)) {
    return 'finished';
  }

  if ([
    'PST',
    'CANC',
    'ABD',
    'AWD',
    'WO',
    'SUSP'
  ].includes(code)) {
    return code.toLowerCase();
  }

  if (code === 'TBD' || code === 'NS') {
    return 'scheduled';
  }

  return code.toLowerCase();
}

function normalizeFixture(fixture, index) {
  const fixtureInfo = fixture?.fixture;
  const teams = fixture?.teams;
  const league = fixture?.league;
  const goals = fixture?.goals;

  const homeName = text(teams?.home?.name);
  const awayName = text(teams?.away?.name);

  if (!homeName || !awayName) {
    return null;
  }

  return {
    id: `api-football:${fixtureInfo?.id ?? index}`,

    date,

    kickoff:
      text(fixtureInfo?.date) ||
      null,

    timezone,

    status: normalizeStatus(
      fixtureInfo?.status?.short,
      fixtureInfo?.status?.long
    ),

    statusShort:
      text(fixtureInfo?.status?.short) ||
      null,

    statusLong:
      text(fixtureInfo?.status?.long) ||
      null,

    elapsed:
      fixtureInfo?.status?.elapsed ??
      null,

    home: {
      id: text(teams?.home?.id),
      name: homeName,
      logo: text(teams?.home?.logo)
    },

    away: {
      id: text(teams?.away?.id),
      name: awayName,
      logo: text(teams?.away?.logo)
    },

    score: {
      home: goals?.home ?? null,
      away: goals?.away ?? null
    },

    competition: {
      id: text(league?.id),
      name: text(league?.name),
      country: text(league?.country),
      logo: text(league?.logo),
      round: text(league?.round)
    },

    venue: {
      id: text(fixtureInfo?.venue?.id),
      name: text(fixtureInfo?.venue?.name),
      city: text(fixtureInfo?.venue?.city)
    },

    broadcasts: [],

    source: {
      name: 'API-Football',
      url: 'https://www.api-football.com/'
    }
  };
}

const url =
  `https://v3.football.api-sports.io/fixtures` +
  `?date=${encodeURIComponent(date)}` +
  `&timezone=${encodeURIComponent(timezone)}`;

console.log(`Consultando API-Football para ${date}...`);

const response = await fetch(url, {
  method: 'GET',
  headers: {
    'x-apisports-key': apiKey,
    'Accept': 'application/json'
  }
});

const responseText = await response.text();

if (!response.ok) {
  throw new Error(
    `API-Football retornou HTTP ${response.status}: ${responseText}`
  );
}

let body;

try {
  body = JSON.parse(responseText);
} catch {
  throw new Error(
    'A API-Football respondeu algo que não é JSON.'
  );
}

if (Array.isArray(body.errors) && body.errors.length > 0) {
  throw new Error(
    `API-Football retornou erros: ${JSON.stringify(body.errors)}`
  );
}

if (!Array.isArray(body.response)) {
  throw new Error(
    'Resposta da API-Football não possui o campo response.'
  );
}

const games = body.response
  .map(normalizeFixture)
  .filter(Boolean)
  .sort((a, b) => {
    return String(a.kickoff || '').localeCompare(
      String(b.kickoff || '')
    );
  });

const data = {
  schemaVersion: 2,
  date,
  timezone,
  updatedAt: new Date().toISOString(),

  source: 'API-Football',

  limitations: [
    'Os jogos são obtidos pelo endpoint /fixtures da API-Football.',
    'As transmissões de TV não são preenchidas nesta rota.'
  ],

  api: {
    provider: 'API-Football',
    endpoint: '/fixtures',
    results: body.results ?? games.length
  },

  games
};

await mkdir(dirname(output), {
  recursive: true
});

const temporary = `${output}.tmp`;

await writeFile(
  temporary,
  `${JSON.stringify(data, null, 2)}\n`,
  'utf8'
);

await rename(temporary, output);

console.log(
  `${games.length} jogos de ${date} gravados em public/games.json`
);
