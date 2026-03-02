function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

async function fetchJson(url){
  const r = await fetch(url, { cache: "no-store" });
  const txt = (await r.text()).trim();
  if (!txt) throw new Error("Risposta vuota");
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

    const title = data.title || "Senza titolo";
    const artist = data.artists?.[0]?.name || "Sconosciuto";
    const year = data.year || "";
    const cover = data.images?.[0]?.uri || "";
    const country = data.country || "";
    const labels = (data.labels || []).map(l => l.name).filter(Boolean);
    const catnos = (data.labels || []).map(l => l.catno).filter(Boolean);
    const formats = (data.formats || []).flatMap(f => f.descriptions || []);
    const genres = data.genres || [];
    const styles = data.styles || [];
    const tracklist = data.tracklist || [];

    const chips = []
      .concat(year ? [chip(`Anno: ${year}`)] : [])
      .concat(labels.slice(0,8).map(l => chip(`Label: ${l}`)))
      .concat(formats.slice(0,6).map(f => chip(`Formato: ${f}`)))
      .concat(genres.slice(0,6).map(g => chip(g)))
      .concat(styles.slice(0,10).map(s => chip(s)))
      .join("");

    const tracksHtml = tracklist.length
      ? `<div style="margin-top:14px;">
          <h2 style="margin:10px 0 6px;">Tracklist</h2>
          ${tracklist.map(t =>
            `<div>${esc(t.position || "")} ${esc(t.title || "")} ${t.duration ? `(${esc(t.duration)})` : ""}</div>`
          ).join("")}
        </div>`
      : "";

    box.innerHTML = `
      <div style="display:grid; grid-template-columns: 240px 1fr; gap:16px;">
        <div>
          <img src="${esc(cover)}" style="width:100%;" />
        </div>

        <div>
          <h1>${esc(title)}</h1>
          <div>${esc(artist)}</div>

          <div style="margin-top:10px;">${chips}</div>

          ${country ? `<div style="margin-top:12px;"><strong>Country:</strong> ${esc(country)}</div>` : ""}
          ${catnos.length ? `<div><strong>Catalog:</strong> ${esc(catnos.join(", "))}</div>` : ""}

          ${tracksHtml}
        </div>
      </div>
    `;

  } catch(e){
    err.classList.remove("hidden");
    err.textContent = "Errore: " + e.message;
  }

})();