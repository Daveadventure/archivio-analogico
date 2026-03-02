function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

async function fetchJson(url){
  const r = await fetch(url, { cache: "no-store" });
  const txt = (await r.text()).trim();
  if (!txt) throw new Error("Risposta vuota");
  const ct = (r.headers.get("content-type")||"").toLowerCase();
  if (!ct.includes("application/json")) throw new Error("Risposta non-JSON");
  const data = JSON.parse(txt);
  if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
  return data;
}

function chip(label){
  return `<span style="display:inline-block;border:1px solid var(--line);padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.55);margin:4px 6px 0 0;font-size:12px;">${esc(label)}</span>`;
}

(async function init(){
  const box = document.getElementById("detail");
  const err = document.getElementById("detailError");

  try{
    const id = new URL(location.href).searchParams.get("id");
    if (!id) throw new Error("ID mancante");

    const data = await fetchJson(`/api/release?id=${encodeURIComponent(id)}`);

    const title = data.title || data.basic_information?.title || "Senza titolo";
    const artist = data.artist || data.artists?.[0]?.name || data.basic_information?.artists?.[0]?.name || "Sconosciuto";
    const year = data.year || data.released || data.basic_information?.year || "";
    const cover = data.cover_image || data.thumb || data.images?.[0]?.uri || data.basic_information?.cover_image || data.basic_information?.thumb || "";
    const labels = (data.labels || data.basic_information?.labels || []).map(l => l?.name).filter(Boolean);
    const formats = (data.formats || data.basic_information?.formats || []).map(f => f?.name).filter(Boolean);
    const genres = (data.genres || data.basic_information?.genres || []).filter(Boolean);
    const styles = (data.styles || data.basic_information?.styles || []).filter(Boolean);
    const tracklist = data.tracklist || [];

    const discogsUri =
      data.uri ||
      data.resource_url ||
      (data.id ? `https://www.discogs.com/release/${encodeURIComponent(String(data.id))}` : null) ||
      (id ? `https://www.discogs.com/release/${encodeURIComponent(String(id))}` : null);

    const chips = []
      .concat(year ? [chip(`Anno: ${year}`)] : [])
      .concat(labels.slice(0,8).map(l => chip(`Label: ${l}`)))
      .concat(formats.slice(0,6).map(f => chip(`Formato: ${f}`)))
      .concat(genres.slice(0,6).map(g => chip(g)))
      .concat(styles.slice(0,10).map(s => chip(s)))
      .join("");

    const tracksHtml = Array.isArray(tracklist) && tracklist.length
      ? `<div style="margin-top:14px;">
          <h2 style="margin:10px 0 6px; font-family:'Baumans',system-ui; letter-spacing:.3px;">Tracklist</h2>
          <div style="border:1px solid var(--line); border-radius: var(--radius); background: rgba(255,255,255,.55); padding:10px 12px;">
            ${tracklist.map(t => {
              const pos = t.position ? `<strong style="display:inline-block; width:44px;">${esc(t.position)}</strong>` : "";
              const dur = t.duration ? `<span style="opacity:.7">(${esc(t.duration)})</span>` : "";
              return `<div style="padding:6px 0; border-bottom:1px dashed rgba(0,0,0,.12);">
                        ${pos}<span>${esc(t.title || "")}</span> ${dur}
                      </div>`;
            }).join("")}
          </div>
        </div>`
      : "";

    box.innerHTML = `
      <div style="display:grid; grid-template-columns: 240px 1fr; gap:16px; align-items:start;">
        <div class="card" style="padding:12px;">
          <div class="cover">
            <img loading="lazy" src="${esc(cover)}" alt="${esc(title)}" style="width:100%; height:auto; display:block;" />
          </div>
        </div>

        <div class="card" style="padding:14px;">
          <div style="font-family:'Baumans',system-ui; font-size:28px; line-height:1.05;">${esc(title)}</div>
          <div style="margin-top:6px; font-size:16px; color: var(--muted);">${esc(artist)}</div>
          <div style="margin-top:10px;">${chips || ""}</div>

          ${discogsUri ? `<div style="margin-top:14px;">
            <a href="${esc(discogsUri)}" target="_blank" rel="noreferrer"
               style="display:inline-block; text-decoration:none; color:var(--ink); border:1px solid var(--line); padding:8px 12px; border-radius:999px; background:rgba(255,255,255,.55);">
              Apri su Discogs ↗
            </a>
          </div>` : ""}

          ${tracksHtml}
        </div>
      </div>
    `;

  } catch(e){
    err.classList.remove("hidden");
    err.textContent = "Errore: " + (e?.message || String(e));
  }
})();


// ===== SPOTIFY EMBED =====
const embed=document.getElementById("spotifyEmbed");
if(embed && data?.title){
  embed.innerHTML=
  '<iframe style="border-radius:12px" src="https://open.spotify.com/embed/search/'+
  encodeURIComponent(data.title)+
  '" width="100%" height="152" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>';
}
