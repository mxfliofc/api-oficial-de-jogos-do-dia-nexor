import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const output = resolve('public/games.json');
const logosDir = resolve('public/logos');

const timezone = process.env.GAMES_TIMEZONE || 'America/Sao_Paulo';
const apiKey = process.env.API_FOOTBALL_KEY;

if (!apiKey) {
  throw new Error('API_FOOTBALL_KEY não configurada nos Secrets do GitHub.');
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
  if (value === null || value === undefined) return null;

  const result = String(value).replace(/\s+/g, ' ').trim();

  return result || null;
}

function normalizeStatus(short) {
  const code = text(short);

  if (!code) return 'scheduled';

  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(code)) {
    return 'live';
  }

  if (['FT', 'AET', 'PEN'].includes(code)) {
    return 'finished';
  }

  if (['PST', 'CANC', 'ABD', 'AWD', 'WO', 'SUSP'].includes(code)) {
    return code.toLowerCase();
  }

  if (['TBD', 'NS'].includes(code)) {
    return 'scheduled';
  }

  return code.toLowerCase();
}

async function downloadLogo(url, teamId) {
  if (!url || !teamId) return null;

  const fileName = `${teamId}.png`;
  const filePath = resolve(logosDir, fileName);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(
        `Não foi possível baixar o escudo ${teamId}: HTTP ${response.status}`
      );

      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (!buffer.length) {
      return null;
    }

    await writeFile(filePath, buffer);

    return `/logos/${fileName}`;
  } catch (error) {
    console.warn(
      `Erro ao baixar escudo ${teamId}:`,
      error.message
    );

    return null;
  }
}

async function normalizeFixture(fixture, index) {
  const fixtureInfo = fixture?.fixture;
  const teams = fixture?.teams;
  const league = fixture?.league;
  const goals = fixture?.goals;

  const homeId = teams?.home?.id;
  const awayId = teams?.away?.id;

  const homeName = text(teams?.home?.name);
  const awayName = text(teams?.away?.name);

  if (!homeName || !awayName) {
    return null;
  }

  const homeLogo =
    await downloadLogo(
      teams?.home?.logo,
      homeId
    );

  const awayLogo =
    await downloadLogo(
      teams?.away?.logo,
      awayId
    );

  const leagueLogo =
    await downloadLogo(
      league?.logo,
      `league-${league?.id}`
    );

  return {
    id: fixtureInfo?.id ?? index,

    date,

    kickoff:
      text(fixtureInfo?.date) || null,

    timezone,

    status: normalizeStatus(
      fixtureInfo?.status?.short
    ),

    statusShort:
      text(fixtureInfo?.status?.short) || null,

    statusLong:
      text(fixtureInfo?.status?.long) || null,

    elapsed:
      fixtureInfo?.status?.elapsed ?? null,

    home: [
      {
        id: homeId ?? null,
        name: homeName,
        logo: homeLogo
      }
    ],

    away: [
      {
        id: awayId ?? null,
        name: awayName,
        logo: awayLogo
      }
    ],

    score: {
      home: goals?.home ?? null,
      away: goals?.away ?? null
    },

    competition: {
      id: league?.id ?? null,
      name: text(league?.name),
      country: text(league?.country),
      logo: leagueLogo,
      round: text(league?.round)
    },

    venue: {
      id: fixtureInfo?.venue?.id ?? null,
      name: text(fixtureInfo?.venue?.name),
      city: text(fixtureInfo?.venue?.city)
    },

    broadcasts: [],

    source: {
      name: 'API-Football'
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
  throw new Error('A API-Football não retornou JSON válido.');
}

if (Array.isArray(body.errors) && body.errors.length > 0) {
  throw new Error(
    `API-Football retornou erros: ${JSON.stringify(body.errors)}`
  );
}

if (!Array.isArray(body.response)) {
  throw new Error(
    'A resposta da API-Football não possui response[].'
  );
}

await mkdir(logosDir, {
  recursive: true
});

const games = [];

for (let i = 0; i < body.response.length; i++) {
  const game = await normalizeFixture(
    body.response[i],
    i
  );

  if (game) {
    games.push(game);
  }
}

games.sort((a, b) => {
  return String(a.kickoff || '').localeCompare(
    String(b.kickoff || '')
  );
});

const temporary = `${output}.tmp`;

await writeFile(
  temporary,
  `${JSON.stringify(games, null, 2)}\n`,
  'utf8'
);

await rename(temporary, output);

console.log(
  `${games.length} jogos gravados em public/games.json`
);

console.log(
  'Escudos armazenados localmente em public/logos/'
);
