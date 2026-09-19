import live from '../public/live.json' with {
  type: 'json'
};

export default function handler(
  request,
  response
) {
  response.setHeader(
    'Content-Type',
    'application/json; charset=utf-8'
  );

  response.setHeader(
    'Cache-Control',
    'public, s-maxage=30, stale-while-revalidate=15'
  );

  response.status(200).json(live);
}
