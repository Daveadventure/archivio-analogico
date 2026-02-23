import "dotenv/config";
import fetch from "node-fetch";

const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN;
const USERNAME = process.env.DISCOGS_USERNAME;
const USER_AGENT = "ViniliDiscogsSite/1.0";

let CACHE = null;
let CACHE_AT = 0;
const TTL_MS = 6 * 60 * 60 * 1000; // 6 ore

function headers() {
  return {
    "User-Agent": USER_AGENT,
    Authorization: `Discogs token=${DISCOGS_TOKEN}`
  };
}

async function fetchAllCollectionRaw() {
  const perPage = 100;
  let page = 1;
  let all = [];

  while (true) {
    const url = `https://api.discogs.com/users/${USERNAME}/collection/folders/0/releases?per_page=${perPage}&page=${page}`;
    const resp = await fetch(url, { headers: headers() });
    const data = await resp.json();

    if (!resp.ok) throw new Error(data?.message || "Errore Discogs collection");

    all = all.concat(data.releases || []);

    const pages = data?.pagination?.pages || 1;
    if (page >= pages) break;
    page++;
  }

  return all;
}

export default async function handler(req, res) {
  try {
    if (!DISCOGS_TOKEN) return res.status(500).json({ error: "DISCOGS_TOKEN mancante" });
    if (!USERNAME) return res.status(500).json({ error: "DISCOGS_USERNAME mancante" });

    const now = Date.now();
    if (CACHE && (now - CACHE_AT) < TTL_MS) {
      return res.status(200).json(CACHE);
    }

    const all = await fetchAllCollectionRaw();
    const genreSet = new Set();
    const styleSet = new Set();

    for (const item of all) {
      const info = item.basic_information || {};
      (info.genres || []).forEach(g => genreSet.add(g));
      (info.styles || []).forEach(s => styleSet.add(s));
    }

    const payload = {
      genres: Array.from(genreSet).sort((a,b) => a.localeCompare(b)),
      styles: Array.from(styleSet).sort((a,b) => a.localeCompare(b))
    };

    CACHE = payload;
    CACHE_AT = Date.now();

    res.status(200).json(payload);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
