export default async function handler(req, res) {
  try {
    const username = process.env.DISCOGS_USERNAME || "DAVE1971";
    const folderId = process.env.DISCOGS_FOLDER_ID || "3617";

    const token = process.env.DISCOGS_TOKEN;
    if (!token) {
      return res.status(500).json({ error: "DISCOGS_TOKEN mancante" });
    }

    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const page = parseInt(urlObj.searchParams.get("page") || "1", 10);
    const perPage = parseInt(urlObj.searchParams.get("per_page") || "100", 10);

    const url =
      `https://api.discogs.com/users/${encodeURIComponent(username)}` +
      `/collection/folders/${encodeURIComponent(folderId)}/releases` +
      `?page=${page}&per_page=${perPage}`;

    const r = await fetch(url, {
      headers: {
        Authorization: `Discogs token=${token}`,
        "User-Agent": "archivio-analogico/1.0",
      },
    });

    const text = await r.text();

    // Discogs a volte risponde non-JSON (rate limit / errori)
    let data;
    try {
      data = JSON.parse(text);
    } catch {
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

    const releasesRaw = Array.isArray(data?.releases) ? data.releases : [];

    const releases = releasesRaw.map((item) => {
      const bi = item?.basic_information || {};
      const formats = Array.isArray(bi.formats) ? bi.formats : [];

      const formatNames = formats.map((f) => f?.name).filter(Boolean);
      const formatDescriptions = formats
        .flatMap((f) => (Array.isArray(f?.descriptions) ? f.descriptions : []))
        .filter(Boolean);

      return {
        release_id: item?.id ?? bi?.id ?? null,
        artist: bi?.artists?.[0]?.name || "",
        title: bi?.title || "",
        year: bi?.year || "",
        country: bi?.country || "",
        formats: formatNames,
        format_descriptions: formatDescriptions,
        labels: (bi?.labels || []).map((l) => l?.name).filter(Boolean),
        genres: bi?.genres || [],
        styles: bi?.styles || [],
        thumb: bi?.thumb || "",
        cover_image: bi?.cover_image || "",
      };
    });

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({
      pagination: data?.pagination || null,
      releases,
    });
  } catch (e) {
    return res.status(500).json({
      error: "Server error in /api/collection",
      message: String(e?.message || e),
    });
  }
}