import "dotenv/config";
import fetch from "node-fetch";

const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN;
const USERNAME = process.env.DISCOGS_USERNAME;
const USER_AGENT = "ViniliDiscogsSite/1.0";

function headers() {
  return {
    "User-Agent": USER_AGENT,
    Authorization: `Discogs token=${DISCOGS_TOKEN}`
  };
}

async function safeJson(resp) {
  const txt = await resp.text();
  if (!txt) return { __empty: true };
  try { return JSON.parse(txt); }
  catch { return { __notJson: true, __text: txt.slice(0, 300) }; }
}

export default async function handler(req, res) {
  try {
    if (!DISCOGS_TOKEN) return res.status(500).json({ error: "DISCOGS_TOKEN mancante" });
    if (!USERNAME) return res.status(500).json({ error: "DISCOGS_USERNAME mancante" });

    const url = new URL(req.url, "http://localhost");
    const pagesWanted = Math.min(5, Math.max(1, parseInt(url.searchParams.get("pages") || "2", 10) || 2));
    const perPage = 100;

    const genres = new Set();
    const styles = new Set();

    for (let page = 1; page <= pagesWanted; page++) {
      const api = `https://api.discogs.com/users/${USERNAME}/collection/folders/0/releases?per_page=${perPage}&page=${page}`;
      const resp = await fetch(api, { headers: headers() });
      const data = await safeJson(resp);

      if (!resp.ok) {
        const msg = data?.message || (data?.__empty ? "Risposta vuota da Discogs" : null) || `HTTP ${resp.status}`;
        return res.status(resp.status).json({ error: msg });
      }
      if (data?.__empty) return res.status(502).json({ error: "Risposta vuota da Discogs" });
      if (data?.__notJson) return res.status(502).json({ error: "Risposta non-JSON da Discogs", detail: data.__text });

      for (const it of (data.releases || [])) {
        const info = it.basic_information || {};
        for (const g of (info.genres || [])) if (g) genres.add(String(g));
        for (const st of (info.styles || [])) if (st) styles.add(String(st));
      }
    }

    return res.status(200).json({
      genres: Array.from(genres).sort((a,b)=>a.localeCompare(b)),
      styles: Array.from(styles).sort((a,b)=>a.localeCompare(b))
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
