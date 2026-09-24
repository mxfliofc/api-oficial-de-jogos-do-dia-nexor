export default function handler(request, response) {
  response.status(200).json({
    ok: true,
    service: "NEXOR API",
    source: "API-Football"
  });
}
