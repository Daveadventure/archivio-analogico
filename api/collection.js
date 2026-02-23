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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function safeJson(resp) {
  const txt = await resp.text();
  if (!txt) return { __empty: true };
  try {
    return JSON.parse(txt);
  } catch {
    return { __notJson: true, __text: txt.slice(0, 400) };
  }
}

async function fetchPage(url, tries = 3) {
  let lastErr = null;

  for (let i = 0; i < tries; i++) {
    try {
      const resp = await fetch(url, { headers: headers() });
      const data = await safeJson(resp);

      if (!resp.ok) {
        const msg =
          data?.message ||
          (data?.__empty ? "Risposta vuota da Discogs" : null) ||
          (data?.__notJson ? `Risposta non JSON (inizio): ${data.__text}` : null) ||
          `Errore Discogs: HTTP ${resp.status}`;

        // transient/rate-limit
        if (resp.status === 429 || resp.status >= 500) {
          lastErr = new Error(msg);
          await sleep(800);
          continue;
        }
        throw new Error(msg);
      }

      if (data?.__empty) {
        lastErr = new Error("Risposta vuota da Discogs");
        await sleep(800);
        continue;
      }
      if (data?.__notJson) {
        lastErr = new Error(`Risposta non JSON (inizio): ${data.__text}`);
        await sleep(800);
        continue;
      }

      return data;
    } catch (e) {
      lastErr = e;
      await sleep(800);
    }
  }

  throw lastErr || new Error("Errore sconosciuto");
}

async function fetchAllCollection() {
  const perPage = 100;
  let page = 1;
  let all = [];

  while (true) {
    const url = `https://api.discogs.com/users/${USERNAME}/collection/folders/0/releases?per_page=${perPage}&page=${page}`;
    const data = await fetchPage(url, 3);

    all = all.concat(data.releases || []);
    const pages = data?.pagination?.pages || 1;

    if (page >= pages) break;
    page++;

    // piccola pausa per stabilità
    await sleep(120);
  }

  return all.map(item => {
    const info = item.basic_information || {};
    return {
      release_id: info.id,
      title: info.title || "Senza titolo",
      artist: info.artists?.[0]?.name || "Sconosciuto",
      year: info.year || null,
      genres: info.genres || [],
      styles: info.styles || [],
      cover_image: info.cover_image,
      thumb: info.thumb
    };
  });
}

export default async function handler(req, res) {
  try {
    if (!DISCOGS_TOKEN) return res.status(500).json({ error: "DISCOGS_TOKEN mancante (.env)" });
    if (!USERNAME) return res.status(500).json({ error: "DISCOGS_USERNAME mancante (.env)" });

    const force = req.query.refresh === "1";
    const now = Date.now();

    if (!force && CACHE && (now - CACHE_AT) < TTL_MS) {
      return res.status(200).json(CACHE);
    }

    const out = await fetchAllCollection();
    CACHE = out;
    CACHE_AT = Date.now();

    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
