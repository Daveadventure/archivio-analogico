import "dotenv/config";
import fetch from "node-fetch";

const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN;
const USER_AGENT = "ViniliDiscogsSite/1.0";

function headers() {
  return {
    "User-Agent": USER_AGENT,
    Authorization: `Discogs token=${DISCOGS_TOKEN}`
  };
}

export default async function handler(req, res) {
  try {
    if (!DISCOGS_TOKEN) return res.status(500).json({ error: "DISCOGS_TOKEN mancante" });

    const id = req.query.id;
    if (!id) return res.status(400).json({ error: "Parametro id mancante" });

    const url = `https://api.discogs.com/releases/${id}`;
    const resp = await fetch(url, { headers: headers() });
    const data = await resp.json();

    if (!resp.ok) return res.status(500).json({ error: data?.message || "Errore Discogs release" });

    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
