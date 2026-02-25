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
  catch { return { __notJson: true, __text: txt.slice(0, 400) }; }
}

function mapItem(item) {
  const info = item.basic_information || {};
  const labels = (info.labels || []).map(l => l?.name ? String(l.name) : null).filter(Boolean);
  const formats = (info.formats || []).map(f => f?.name ? String(f.name) : null).filter(Boolean);

  return {
    release_id: info.id,
    title: info.title || "Senza titolo",
    artist: info.artists?.[0]?.name || "Sconosciuto",
    year: info.year || null,
    genres: info.genres || [],
    styles: info.styles || [],
    labels,
    formats,
    cover_image: info.cover_image,
    thumb: info.thumb
  };
}

export default async function handler(req, res) {
  try {
    if (!DISCOGS_TOKEN) return res.status(500).json({ error: "DISCOGS_TOKEN mancante (.env / Vercel env)" });
    if (!USERNAME) return res.status(500).json({ error: "DISCOGS_USERNAME mancante (.env / Vercel env)" });

    const page = Math.max(1, parseInt(req.query?.page || "1", 10) || 1);
    const perPage = Math.min(100, Math.max(10, parseInt(req.query?.per_page || "100", 10) || 100));

    const url = `https://api.discogs.com/users/${USERNAME}/collection/folders/0/releases?per_page=${perPage}&page=${page}`;
    const resp = await fetch(url, { headers: headers() });
    const data = await safeJson(resp);

    if (!resp.ok) {
      const msg = data?.message || (data?.__empty ? "Risposta vuota da Discogs" : null) || `HTTP ${resp.status}`;
      return res.status(resp.status).json({ error: msg });
    }
    if (data?.__empty) return res.status(502).json({ error: "Risposta vuota da Discogs" });
    if (data?.__notJson) return res.status(502).json({ error: "Risposta non-JSON da Discogs", detail: data.__text });

    const releases = (data.releases || []).map(mapItem);
    const pagination = data.pagination || { page, pages: page, per_page: perPage, items: releases.length };

    return res.status(200).json({ releases, pagination });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
