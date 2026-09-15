import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const output = resolve('public/games.json');
const logosDir = resolve('public/logos');

const timezone = process.env.GAMES_TIMEZONE || 'America/Sao_Paulo';
const apiKey = process.env.API_FOOTBALL_KEY;

if (!apiKey) {
  throw new Error(
    'API_FOOTBALL_KEY não configurada nos Secrets do GitHub.'
  );
}

/* =========================================================
   DATA ATUAL NO FUSO DO PROJETO
   ========================================================= */

function getLocalDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

const date = getLocalDate();

/* =========================================================
   FUNÇÕES AUXILIARES
   ========================================================= */

function text(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const result = String(value)
    .replace(/\s+/g, ' ')
    .trim();

  return result || null;
}

function numberOrNull(value) {
  return typeof value === 'number' ? value : null;
}

/* =========================================================
   STATUS DA PARTIDA
   ========================================================= */

function normalizeStatus(short) {
  const code = text(short);

  if (!code) {
    return 'scheduled';
  }

  if (
    [
      '1H',
      '2H',
      'HT',
      'ET',
      'BT',
      'P',
      'LIVE'
    ].includes(code)
  ) {
    return 'live';
  }

  if (
    [
      'FT',
      'AET',
      'PEN'
    ].includes(code)
  ) {
    return 'finished';
  }

  if (
    [
      'PST',
      'CANC',
      'ABD',
      'AWD',
      'WO',
      'SUSP'
    ].includes(code)
  ) {
    return code.toLowerCase();
  }

  if (
    [
      'NS',
      'TBD'
    ].includes(code)
  ) {
    return 'scheduled';
  }

  return code.toLowerCase();
}

/* =========================================================
   DOWNLOAD DOS LOGOS
   ========================================================= */

async function downloadLogo(url, fileName) {
  if (!url || !fileName) {
    return null;
  }

  const filePath = resolve(
    logosDir,
    fileName
  );

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(
        `Erro ao baixar logo ${fileName}: HTTP ${response.status}`
      );

      return null;
    }

    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    if (!buffer.length) {
      return null;
    }

    await writeFile(
      filePath,
      buffer
    );

    return `/logos/${fileName}`;

  } catch (error) {
    console.warn(
      `Erro ao baixar logo ${fileName}: ${error.message}`
    );

    return null;
  }
}

/* =========================================================
   NORMALIZAÇÃO DA PARTIDA
   ========================================================= */

async function normalizeFixture(fixture, index) {

  const fixtureInfo = fixture?.fixture;
  const teams = fixture?.teams;
  const league = fixture?.league;
  const goals = fixture?.goals;
  const score = fixture?.score;

  const homeId = numberOrNull(
    teams?.home?.id
  );

  const awayId = numberOrNull(
    teams?.away?.id
  );

  const homeName = text(
    teams?.home?.name
  );

  const awayName = text(
    teams?.away?.name
  );

  if (!homeName || !awayName) {
    return null;
  }

  /* =======================================================
     LOGOS
     ======================================================= */

  const homeLogo = await downloadLogo(
    teams?.home?.logo,
    `${homeId}.png`
  );

  const awayLogo = await downloadLogo(
    teams?.away?.logo,
    `${awayId}.png`
  );

  let competitionLogo = null;

  if (league?.logo && league?.id) {
    competitionLogo = await downloadLogo(
      league.logo,
      `league-${league.id}.png`
    );
  }

  /* =======================================================
     OBJETO FINAL
     
     IMPORTANTE:
     TUDO FICA NO MESMO NÍVEL.
     NÃO EXISTEM OBJETOS HOME/AWAY/SCORE ETC.
     ======================================================= */

  return {

    /* =====================================================
       1. IDENTIFICAÇÃO DA PARTIDA
       ===================================================== */

    id:
      numberOrNull(fixtureInfo?.id) ??
      index,

    date,

    kickoff:
      text(fixtureInfo?.date),

    timezone,

    /* =====================================================
       2. TIMES
       ===================================================== */

    home_id:
      homeId,

    home_name:
      homeName,

    home_logo:
      homeLogo,

    home_winner:
      teams?.home?.winner ?? null,

    away_id:
      awayId,

    away_name:
      awayName,

    away_logo:
      awayLogo,

    away_winner:
      teams?.away?.winner ?? null,

    /* =====================================================
       3. PLACAR ATUAL
       ===================================================== */

    score_home:
      goals?.home ?? null,

    score_away:
      goals?.away ?? null,

    /* =====================================================
       4. STATUS
       ===================================================== */

    status:
      normalizeStatus(
        fixtureInfo?.status?.short
      ),

    statusShort:
      text(fixtureInfo?.status?.short),

    statusLong:
      text(fixtureInfo?.status?.long),

    elapsed:
      fixtureInfo?.status?.elapsed ?? null,

    extra_time:
      fixtureInfo?.status?.extra ?? null,

    /* =====================================================
       5. PLACARES POR PERÍODO
       ===================================================== */

    halftime_home:
      score?.halftime?.home ?? null,

    halftime_away:
      score?.halftime?.away ?? null,

    fulltime_home:
      score?.fulltime?.home ?? null,

    fulltime_away:
      score?.fulltime?.away ?? null,

    extratime_home:
      score?.extratime?.home ?? null,

    extratime_away:
      score?.extratime?.away ?? null,

    penalty_home:
      score?.penalty?.home ?? null,

    penalty_away:
      score?.penalty?.away ?? null,

    /* =====================================================
       6. COMPETIÇÃO
       ===================================================== */

    competition_id:
      numberOrNull(league?.id),

    competition_name:
      text(league?.name),

    competition_country:
      text(league?.country),

    competition_logo:
      competitionLogo,

    competition_flag:
      text(league?.flag),

    competition_season:
      league?.season ?? null,

    competition_round:
      text(league?.round),

    competition_standings:
      league?.standings ?? null,

    /* =====================================================
       7. ESTÁDIO
       ===================================================== */

    venue_id:
      numberOrNull(fixtureInfo?.venue?.id),

    venue_name:
      text(fixtureInfo?.venue?.name),

    venue_city:
      text(fixtureInfo?.venue?.city),

    /* =====================================================
       8. ARBITRAGEM
       ===================================================== */

    referee:
      text(fixtureInfo?.referee),

    /* =====================================================
       9. INFORMAÇÕES TÉCNICAS DA PARTIDA
       ===================================================== */

    fixture_timezone:
      text(fixtureInfo?.timezone),

    fixture_timestamp:
      fixtureInfo?.timestamp ?? null,

    period_first:
      fixtureInfo?.periods?.first ?? null,

    period_second:
      fixtureInfo?.periods?.second ?? null,

    /* =====================================================
       10. TRANSMISSÕES
       ===================================================== */

    broadcasts: [],

    /* =====================================================
       11. FONTE
       ===================================================== */

    source_name:
      'API-Football'

  };
}

/* =========================================================
   CONSULTA API-FOOTBALL
   ========================================================= */

const url =
  `https://v3.football.api-sports.io/fixtures` +
  `?date=${encodeURIComponent(date)}` +
  `&timezone=${encodeURIComponent(timezone)}`;

console.log(
  `Consultando API-Football para ${date}...`
);

const response = await fetch(
  url,
  {
    method: 'GET',

    headers: {
      'x-apisports-key': apiKey,
      'Accept': 'application/json'
    }
  }
);

const responseText =
  await response.text();

if (!response.ok) {
  throw new Error(
    `API-Football retornou HTTP ${response.status}: ${responseText}`
  );
}

/* =========================================================
   JSON DA API
   ========================================================= */

let body;

try {

  body =
    JSON.parse(responseText);

} catch {

  throw new Error(
    'A API-Football não retornou JSON válido.'
  );

}

/* =========================================================
   ERROS DA API
   ========================================================= */

if (
  Array.isArray(body.errors) &&
  body.errors.length > 0
) {

  throw new Error(
    `API-Football retornou erros: ${JSON.stringify(body.errors)}`
  );

}

/* =========================================================
   VERIFICAR RESPONSE
   ========================================================= */

if (!Array.isArray(body.response)) {

  throw new Error(
    'A resposta da API-Football não possui response[].'
  );

}

/* =========================================================
   CRIAR PASTA DOS LOGOS
   ========================================================= */

await mkdir(
  logosDir,
  {
    recursive: true
  }
);

/* =========================================================
   GERAR JOGOS
   ========================================================= */

const games = [];

for (
  let i = 0;
  i < body.response.length;
  i++
) {

  const game =
    await normalizeFixture(
      body.response[i],
      i
    );

  if (game) {
    games.push(game);
  }

}

/* =========================================================
   ORDENAR POR HORÁRIO
   ========================================================= */

games.sort(
  (a, b) =>
    String(a.kickoff || '')
      .localeCompare(
        String(b.kickoff || '')
      )
);

/* =========================================================
   SALVAR GAMES.JSON
   ========================================================= */

const temporary =
  `${output}.tmp`;

await writeFile(
  temporary,
  `${JSON.stringify(games, null, 2)}\n`,
  'utf8'
);

await rename(
  temporary,
  output
);

/* =========================================================
   RESULTADO
   ========================================================= */

console.log(
  `${games.length} jogos de ${date} gravados em public/games.json`
);

console.log(
  `Logos armazenados em public/logos/`
);
