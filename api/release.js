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
    const token = process.env.DISCOGS_TOKEN;
    if (!token) {
      return res.status(500).json({ error: "DISCOGS_TOKEN mancante" });
    }

    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const id = urlObj.searchParams.get("id");

    if (!id) {
      return res.status(400).json({ error: "ID mancante" });
    }

    const r = await fetch(`https://api.discogs.com/releases/${id}`, {
      headers: {
        Authorization: `Discogs token=${token}`,
        "User-Agent": "archivio-analogico/1.0",
      },
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json(data);
    }

    return res.status(200).json({
      country: data.country || "",
      year: data.year || "",
      labels: (data.labels || []).map(l => l.name),
      catno: (data.labels || []).map(l => l.catno),
      formats: (data.formats || []).flatMap(f => f.descriptions || []),
      tracklist: data.tracklist || [],
      notes: data.notes || ""
    });

  } catch (e) {
    return res.status(500).json({ error: "Errore release", message: String(e) });
  }
}