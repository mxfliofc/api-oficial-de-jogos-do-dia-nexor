import games from "../../public/games.json" with { type: "json" };

export default function handler(request, response) {
  const id = Number(request.query.id);

  if (!Number.isInteger(id)) {
    return response.status(400).json({
      error: {
        code: 400,
        message: "Invalid match ID"
      }
    });
  }

  const game = games.find(
    (item) => Number(item.id) === id
  );

  if (!game) {
    return response.status(404).json({
      error: {
        code: 404,
        message: "Match not found"
      }
    });
  }

  response.setHeader(
    "Cache-Control",
    "public, s-maxage=300, stale-while-revalidate=60"
  );

  return response.status(200).json(game);
}
