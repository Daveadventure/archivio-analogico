let collection = [];
let filtered = [];
let limit = 200;

const grid = document.getElementById("grid");
const empty = document.getElementById("empty");
const count = document.getElementById("count");
const moreBtn = document.getElementById("more");
const statusEl = document.getElementById("status");

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}

window.addEventListener("error", (e) => {
  setStatus("ERRORE JS: " + (e?.message || "errore sconosciuto"));
});

async function fetchJson(url, tries = 2) {
  let lastErr = null;

  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const txt = await res.text();

      if (!res.ok) {
        try {
          const j = JSON.parse(txt || "{}");
          throw new Error(j?.error || j?.message || `HTTP ${res.status}`);
        } catch {
          throw new Error(`HTTP ${res.status}: ${txt.slice(0, 120)}`);
        }
      }

      if (!txt) throw new Error("Risposta vuota dal server");

      try {
        return JSON.parse(txt);
      } catch {
        throw new Error("Risposta non-JSON (inizio): " + txt.slice(0, 120));
      }
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 450));
    }
  }

  throw lastErr || new Error("Errore sconosciuto");
}

init();

async function init() {
  try {
    setStatus("Stato: avvio…");

    setStatus("Stato: carico filtri…");
    await loadFilters();

    setStatus("Stato: carico collezione (prima volta può essere lenta)…");
    await loadCollection();

    setStatus(`Stato: collezione caricata (${collection.length} dischi). Render…`);
    applyAll();

    setStatus(`Stato: render ok (${filtered.length} risultati).`);
    wire();
  } catch (e) {
    setStatus("ERRORE: " + (e?.message || String(e)));
  }
}

function wire() {
  const resetAndApply = () => { limit = 200; applyAll(); };

  document.getElementById("search").addEventListener("input", resetAndApply);
  document.getElementById("genre").addEventListener("change", resetAndApply);
  document.getElementById("style").addEventListener("change", resetAndApply);
  document.getElementById("sort").addEventListener("change", resetAndApply);

  moreBtn.addEventListener("click", () => {
    limit += 200;
    render(filtered);
  });
}

async function loadFilters() {
  const data = await fetchJson("/api/filters", 2);

  const genreEl = document.getElementById("genre");
  const styleEl = document.getElementById("style");

  (data.genres || []).forEach(g => {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = g;
    genreEl.appendChild(opt);
  });

  (data.styles || []).forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    styleEl.appendChild(opt);
  });
}

async function loadCollection() {
  const data = await fetchJson("/api/collection", 2);

  if (data && data.error) throw new Error(data.error);

  collection = Array.isArray(data) ? data : [];
  filtered = [...collection];
}

function applyAll() {
  const q = (document.getElementById("search").value || "").trim().toLowerCase();
  const genre = document.getElementById("genre").value;
  const style = document.getElementById("style").value;
  const sort = document.getElementById("sort").value;

  filtered = collection.filter(item => {
    const inQuery =
      !q ||
      (item.title || "").toLowerCase().includes(q) ||
      (item.artist || "").toLowerCase().includes(q);

    const inGenre = !genre || (item.genres || []).includes(genre);
    const inStyle = !style || (item.styles || []).includes(style);

    return inQuery && inGenre && inStyle;
  });

  filtered = sortItems(filtered, sort);

  render(filtered);
  updateCount(filtered.length, collection.length);
}

function sortItems(items, sort) {
  const arr = [...items];

  if (sort === "artist") arr.sort((a,b) => (a.artist || "").localeCompare(b.artist || ""));
  else if (sort === "title") arr.sort((a,b) => (a.title || "").localeCompare(b.title || ""));
  else if (sort === "year_desc") arr.sort((a,b) => (b.year || 0) - (a.year || 0));
  else if (sort === "year_asc") arr.sort((a,b) => (a.year || 0) - (b.year || 0));

  return arr;
}

function updateCount(n, total) {
  if (count) count.textContent = `${n} / ${total} dischi`;
  if (empty) empty.classList.toggle("hidden", n !== 0);
}

function render(items) {
  grid.innerHTML = "";
  const slice = items.slice(0, limit);

  for (const item of slice) {
    const link = document.createElement("a");
    link.className = "cardlink";
    link.href = `/detail.html?id=${encodeURIComponent(item.release_id)}`;

    const card = document.createElement("article");
    card.className = "card";

    const yearBadge = item.year ? `<span class="badge">${item.year}</span>` : "";
    const genreBadge = item.genres?.[0] ? `<span class="badge">${item.genres[0]}</span>` : "";
    const styleBadge = item.styles?.[0] ? `<span class="badge">${item.styles[0]}</span>` : "";

    card.innerHTML = `
      <div class="cover">
        <img src="${item.cover_image || item.thumb || ""}" alt="${escapeHtml(item.title)}"/>
      </div>
      <h3 class="title">${escapeHtml(item.title)}</h3>
      <p class="artist">${escapeHtml(item.artist)}</p>
      <div class="badges">${yearBadge}${genreBadge}${styleBadge}</div>
    `;

    link.appendChild(card);
    grid.appendChild(link);
  }

  moreBtn.classList.toggle("hidden", items.length <= limit);
}

function escapeHtml(str) {
  return (str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
