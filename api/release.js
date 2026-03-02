export default async function handler(req, res) {
  try {
    const token = process.env.DISCOGS_TOKEN;
    if (!token) return res.status(500).json({ error: "DISCOGS_TOKEN mancante" });

    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const id = urlObj.searchParams.get("id");
    if (!id) return res.status(400).json({ error: "ID mancante" });

    const r = await fetch(`https://api.discogs.com/releases/${encodeURIComponent(id)}`, {
      headers: {
        Authorization: `Discogs token=${token}`,
        "User-Agent": "archivio-analogico/1.0",
      },
    });

    const text = await r.text();
    let data;
    try { data = JSON.parse(text); }
    catch {
      return res.status(r.status).json({
        error: "Risposta non-JSON da Discogs",
        status: r.status,
        body_snippet: text.slice(0, 200),
      });
    }

    if (!r.ok) {
      return res.status(r.status).json({
        error: "Errore Discogs",
        status: r.status,
        message: data?.message || data?.error || "unknown",
      });
    }

    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: "Errore /api/release", message: String(e?.message || e) });
  }
}
