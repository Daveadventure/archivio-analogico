const container = document.getElementById("detail");
const params = new URLSearchParams(location.search);
const id = params.get("id");

if (!id) {
  container.innerHTML = `<div class="smallmuted">ID mancante. Torna indietro e riprova.</div>`;
} else {
  loadDetail(id);
}

async function loadDetail(id) {
  try {
    const res = await fetch(`/api/release?id=${encodeURIComponent(id)}`);
    const data = await res.json();

    if (data.error) {
      container.innerHTML = `<div class="smallmuted">Errore: ${escapeHtml(data.error)}</div>`;
      return;
    }

    const title = data.title || "Senza titolo";
    const artists = (data.artists || []).map(a => a.name).join(", ") || "Sconosciuto";
    const year = data.year ? String(data.year) : "—";
    const labels = (data.labels || []).map(l => l.name).join(", ") || "—";
    const genres = (data.genres || []).join(", ") || "—";
    const styles = (data.styles || []).join(", ") || "—";
    const country = data.country || "—";
    const cover = data.images?.[0]?.uri || "";

    const tracklist = (data.tracklist || [])
      .map(t => `<li>${escapeHtml((t.position ? t.position + " — " : "") + t.title)}</li>`)
      .join("");

    container.innerHTML = `
      <div class="detailgrid">
        <div>
          <div class="detailcover">
            <img src="${cover}" alt="${escapeHtml(title)}">
          </div>
        </div>

        <div>
          <h1 class="h2">${escapeHtml(title)}</h1>
          <p class="kv"><strong>${escapeHtml(artists)}</strong> • ${escapeHtml(year)}</p>

          <div class="badges">
            <span class="badge">Paese: ${escapeHtml(country)}</span>
            <span class="badge">Label: ${escapeHtml(labels)}</span>
          </div>

          <hr class="sep"/>

          <div class="smallmuted">
            <div><strong>Generi:</strong> ${escapeHtml(genres)}</div>
            <div><strong>Stili:</strong> ${escapeHtml(styles)}</div>
          </div>

          <hr class="sep"/>

          <h3 class="title">Tracklist</h3>
          ${tracklist ? `<ol class="list">${tracklist}</ol>` : `<div class="smallmuted">Tracklist non disponibile.</div>`}
        </div>
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="smallmuted">Errore imprevisto: ${escapeHtml(e.message)}</div>`;
  }
}

function escapeHtml(str) {
  return (str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
