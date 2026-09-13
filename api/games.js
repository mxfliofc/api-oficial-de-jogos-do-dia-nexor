import games from '../public/games.json' with { type: 'json' };

export default function handler(request, response) {
  response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
  response.status(200).json(games);
}
