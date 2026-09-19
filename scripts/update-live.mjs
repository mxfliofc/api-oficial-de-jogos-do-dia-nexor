import { writeFile } from 'node:fs/promises';

const API_BASE =
  'https://api.sportmonks.com/v3/football';

const TOKEN =
  process.env.SPORTMONKS_API_TOKEN;

if (!TOKEN) {
  throw new Error(
    'SPORTMONKS_API_TOKEN não foi configurado.'
  );
}

const includes = [
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
  'statistics.type',
  'formations',
  'referees',
  'xGFixture'
].join(';');

const url =
  `${API_BASE}/livescores/inplay` +
  `?api_token=${encodeURIComponent(TOKEN)}` +
  `&include=${encodeURIComponent(includes)}`;

console.log(
  'Atualizando jogos ao vivo...'
);

const response =
  await fetch(url);

const text =
  await response.text();

if (!response.ok) {
  throw new Error(
    `Sportmonks HTTP ${response.status}: ${text}`
  );
}

const json =
  JSON.parse(text);

const liveGames =
  Array.isArray(json.data)
    ? json.data
    : [];

const simplified =
  liveGames.map(fixture => {
    const participants =
      fixture.participants || [];

    const home =
      participants.find(
        p =>
          p.meta?.location === 'home'
      ) ||
      participants[0] ||
      null;

    const away =
      participants.find(
        p =>
          p.meta?.location === 'away'
      ) ||
      participants[1] ||
      null;

    const homeId =
      home?.id ?? null;

    const awayId =
      away?.id ?? null;

    const scores =
      fixture.scores || [];

    function currentScore(id) {
      const item =
        scores.find(
          score =>
            score.participant_id === id &&
            (
              score.description === 'CURRENT' ||
              score.type?.developer_name === 'CURRENT'
            )
        );

      return (
        item?.score?.goals ??
        item?.score?.score ??
        0
      );
    }

    return {
      id: fixture.id,

      name:
        fixture.name ?? null,

      kickoff:
        fixture.starting_at ?? null,

      kickoff_timestamp:
        fixture.starting_at_timestamp ?? null,

      status:
        fixture.state?.short_name ??
        fixture.state?.developer_name ??
        fixture.state?.name ??
        null,

      status_name:
        fixture.state?.name ??
        null,

      minute:
        fixture.state?.minutes ??
        null,

      state:
        fixture.state ??
        null,

      home_id:
        homeId,

      home_name:
        home?.name ??
        null,

      home_short_code:
        home?.short_code ??
        home?.code ??
        null,

      home_logo:
        homeId
          ? `/logos/${homeId}.png`
          : home?.image_path ??
            null,

      away_id:
        awayId,

      away_name:
        away?.name ??
        null,

      away_short_code:
        away?.short_code ??
        away?.code ??
        null,

      away_logo:
        awayId
          ? `/logos/${awayId}.png`
          : away?.image_path ??
            null,

      score_home:
        currentScore(homeId),

      score_away:
        currentScore(awayId),

      competition_id:
        fixture.league_id ??
        fixture.league?.id ??
        null,

      competition_name:
        fixture.league?.name ??
        null,

      competition_logo:
        fixture.league?.image_path ??
        null,

      venue_id:
        fixture.venue_id ??
        null,

      venue_name:
        fixture.venue?.name ??
        null,

      events:
        fixture.events ??
        [],

      lineups:
        fixture.lineups ??
        [],

      statistics:
        fixture.statistics ??
        [],

      formations:
        fixture.formations ??
        [],

      referees:
        fixture.referees ??
        [],

      xg:
        fixture.xGFixture ??
        [],

      updated_at:
        new Date().toISOString()
    };
  });

const output = {
  generated_at:
    new Date().toISOString(),

  total:
    simplified.length,

  live:
    simplified
};

await writeFile(
  'public/live.json',
  JSON.stringify(
    simplified,
    null,
    2
  ) + '\n',
  'utf8'
);

await writeFile(
  'public/live-meta.json',
  JSON.stringify(
    output,
    null,
    2
  ) + '\n',
  'utf8'
);

console.log(
  `Jogos ao vivo: ${simplified.length}`
);
