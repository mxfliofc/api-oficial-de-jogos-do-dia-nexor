import games from "../public/live.json" with { type: "json" };

export default function handler(request, response) {
  response.setHeader(
    "Cache-Control",
    "public, s-maxage=30, stale-while-revalidate=15"
  );

  response.status(200).json(games);
}
