const TIMEZONE = "America/Sao_Paulo";

function localDate(isoDate) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(isoDate));
}

function localKickoff(isoDate) {
  const date = new Date(isoDate);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const values = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    timeZoneName: "longOffset"
  })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")
    ?.value
    ?.replace("GMT", "");

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}${offset || "-03:00"}`;
}

function normalizeTeam(team) {
  if (!team) {
    return null;
  }

  return {
    id: team.id ?? null,
    name: team.name ?? null,
    logo: team.id ? `/logos/${team.id}.png` : null,
    winner: team.winner ?? null
  };
}

function normalizeEvents(events = []) {
  return events.map((event) => ({
    time: event.time ?? null,
    team_id: event.team?.id ?? null,
    team_name: event.team?.name ?? null,
    player_id: event.player?.id ?? null,
    player_name: event.player?.name ?? null,
    assist_id: event.assist?.id ?? null,
    assist_name: event.assist?.name ?? null,
    type: event.type ?? null,
    detail: event.detail ?? null,
    comments: event.comments ?? null
  }));
}

function normalizeLineups(lineups = []) {
  return lineups.map((lineup) => ({
    team_id: lineup.team?.id ?? null,
    team_name: lineup.team?.name ?? null,
    formation: lineup.formation ?? null,
    coach: lineup.coach
      ? {
          id: lineup.coach.id ?? null,
          name: lineup.coach.name ?? null,
          photo: lineup.coach.photo ?? null
        }
      : null,
    startXI: lineup.startXI ?? [],
    substitutes: lineup.substitutes ?? []
  }));
}

function normalizeStatistics(statistics = []) {
  return statistics.map((item) => ({
    team_id: item.team?.id ?? null,
    team_name: item.team?.name ?? null,
    statistics: item.statistics ?? []
  }));
}

function normalizePlayers(players = []) {
  return players.map((item) => ({
    team_id: item.team?.id ?? null,
    team_name: item.team?.name ?? null,
    players: item.players ?? []
  }));
}

export function normalizeFixture(item) {
  const fixture = item.fixture || {};
  const league = item.league || {};
  const teams = item.teams || {};
  const goals = item.goals || {};

  return {
    id: fixture.id ?? null,

    date: fixture.date
      ? localDate(fixture.date)
      : null,

    kickoff: fixture.date
      ? localKickoff(fixture.date)
      : null,

    timezone: TIMEZONE,

    timestamp: fixture.timestamp ?? null,

    status: fixture.status?.long ?? null,
    status_short: fixture.status?.short ?? null,
    elapsed: fixture.status?.elapsed ?? null,
    status_extra: fixture.status?.extra ?? null,

    venue_id: fixture.venue?.id ?? null,
    venue_name: fixture.venue?.name ?? null,
    venue_city: fixture.venue?.city ?? null,

    referee: fixture.referee ?? null,

    home_id: teams.home?.id ?? null,
    home_name: teams.home?.name ?? null,
    home_logo: teams.home?.id
      ? `/logos/${teams.home.id}.png`
      : null,
    home_winner: teams.home?.winner ?? null,

    away_id: teams.away?.id ?? null,
    away_name: teams.away?.name ?? null,
    away_logo: teams.away?.id
      ? `/logos/${teams.away.id}.png`
      : null,
    away_winner: teams.away?.winner ?? null,

    score_home: goals.home ?? null,
    score_away: goals.away ?? null,

    score_halftime_home:
      item.score?.halftime?.home ?? null,

    score_halftime_away:
      item.score?.halftime?.away ?? null,

    score_fulltime_home:
      item.score?.fulltime?.home ?? null,

    score_fulltime_away:
      item.score?.fulltime?.away ?? null,

    score_extratime_home:
      item.score?.extratime?.home ?? null,

    score_extratime_away:
      item.score?.extratime?.away ?? null,

    score_penalty_home:
      item.score?.penalty?.home ?? null,

    score_penalty_away:
      item.score?.penalty?.away ?? null,

    competition_id: league.id ?? null,
    competition_name: league.name ?? null,
    competition_country: league.country ?? null,

    competition_logo: league.id
      ? `/logos/leagues/${league.id}.png`
      : null,

    competition_flag: league.flag ?? null,

    season: league.season ?? null,
    round: league.round ?? null,
    standings: league.standings ?? null,

    events: normalizeEvents(item.events),
    lineups: normalizeLineups(item.lineups),
    statistics: normalizeStatistics(item.statistics),
    players: normalizePlayers(item.players)
  };
}
