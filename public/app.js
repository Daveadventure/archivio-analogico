// DEBUG STAMP (rimuovibile)
try {
  const dbg = window.__AA_DEBUG__;
  if (dbg) dbg("DEBUG: app.js caricato ✅");
  const loader = document.getElementById("loader");
  if (loader) loader.textContent = "JS avviato…";
} catch {}

let collection = [];
let filtered = [];
let limit = 200;
let totalItems = 0;
let loadedItems = 0;

const grid = document.getElementById("grid");
const empty = document.getElementById("empty");
const count = document.getElementById("count");
const moreBtn = document.getElementById("more");

const FAV_KEY = "aa_favs_v1";
function loadFavs() {
  try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")); }
  catch { return new Set(); }
}
function saveFavs(set) {
  localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(set)));
}
let favs = loadFavs();

const VIEW_KEY = "aa_view_v1";
function loadView(){
  return localStorage.getItem(VIEW_KEY) || "grid";
}
function saveView(v){
  localStorage.setItem(VIEW_KEY, v);
}
function applyView(v){
  document.body.classList.toggle("view-list", v === "list");
}


function debounce(fn, ms=250){
  let t=null;
  return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); };
}

const statusEl = document.getElementById("status");
const loaderEl = document.getElementById("loader");

function setStatus(msg) {
  // status box rimosso: manteniamo compatibilità senza mostrare debug
  console.log(msg);
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


async function syncFavsFromServer() {
  try {
    const data = await fetchJson("/api/favorites", 2);
    const serverIds = new Set((data.ids || []).map(String));

    // merge: unione locale + server
    for (const id of favs) serverIds.add(String(id));
    favs = serverIds;
    saveFavs(favs);

    // push al server gli eventuali locali mancanti
    for (const id of favs) {
      // best effort: upsert
      fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: String(id) }) }).catch(()=>{});
    }
  } catch {
    // offline / errore: restiamo in locale
  }
}

async function setFavOnServer(id, isFav) {
  try {
    if (isFav) {
      await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: String(id) }) });
    } else {
      await fetch("/api/favorites?id=" + encodeURIComponent(String(id)), { method: "DELETE" });
    }
  } catch {
    // best effort: ignora
  }
}


init();

async function init() {
  try {
    if (loaderEl) loaderEl.textContent = "Caricamento collezione…";
    if (loaderEl) loaderEl.classList.remove("hidden");

    setStatus("Stato: carico filtri…");
    await loadFilters();

    // Vista (grid/list) persistente
    const viewEl = document.getElementById("view");
    if (viewEl) {
      const v = loadView();
      viewEl.value = v;
      applyView(v);
    }

    setStatus("Stato: carico collezione (prima volta può essere lenta)…");
    await loadCollection();

    populateDecades(collection);
    populateLabels(collection);
    populateFormats(collection);

    setStatus(`Stato: collezione caricata (${collection.length} dischi). Render…`);
    applyAll();

    if (loaderEl) loaderEl.classList.add("hidden");

    setStatus(`Stato: render ok (${filtered.length} risultati).`);
    wire();
  } catch (e) {
    if (loaderEl) { loaderEl.textContent = "Errore: " + (e?.message || String(e)); loaderEl.classList.remove("hidden"); }
  }
}

function wire() {
  const applyDebounced = debounce(() => { limit = 200; applyAll();
  document.getElementById("reset").addEventListener("click", () => {
    document.getElementById("search").value = "";
    document.getElementById("genre").value = "";
    document.getElementById("style").value = "";
    document.getElementById("decade").value = "";
    document.getElementById("label").value = "";
    document.getElementById("format").value = "";
    document.getElementById("yearFrom").value = "";
    document.getElementById("yearTo").value = "";
    document.getElementById("onlyFavs").checked = false;

    // reset sort (ma NON tocca la vista scelta)
    document.getElementById("sort").value = "added";

    limit = 200;
    applyAll();
  });
}
, 220);
  const applyNow = () => { limit = 200; applyAll(); };

  document.getElementById("search").addEventListener("input", applyDebounced);
  document.getElementById("genre").addEventListener("change", applyNow);
  document.getElementById("style").addEventListener("change", applyNow);
  document.getElementById("sort").addEventListener("change", applyNow);
  document.getElementById("yearFrom").addEventListener("input", applyDebounced);
  document.getElementById("yearTo").addEventListener("input", applyDebounced);
  document.getElementById("onlyFavs").addEventListener("change", applyNow);

  moreBtn.addEventListener("click", () => {
    limit += 200;
    render(filtered);
  });
}
;

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
  const decadeEl = document.getElementById("decade");

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
  // Caricamento paginato NON bloccante: mostra subito e poi continua in background
  const perPage = 100;

  updateLoaderProgress("");

  const first = await fetchJson(`/api/collection?page=1&per_page=${perPage}`, 2);
  const page1 = Array.isArray(first.releases) ? first.releases : [];
  const pag = first.pagination || {};
  const pages = parseInt(pag.pages || 1, 10);
  totalItems = parseInt(pag.items || 0, 10) || 0;

  collection = page1;
  loadedItems = collection.length;
  filtered = [...collection];

  // aggiorna menu derivati (decenni/label/formati) e render immediato
  if (typeof populateDecades === "function") populateDecades(collection);
  if (typeof populateLabels === "function") populateLabels(collection);
  if (typeof populateFormats === "function") populateFormats(collection);

  applyAll(); // <-- MOSTRA SUBITO I VINILI
  updateLoaderProgress("");

  // continua in background senza bloccare init
  (async () => {
    for (let page = 2; page <= pages; page++) {
      try {
        updateLoaderProgress(`(pagina ${page}/${pages})`);
        const data = await fetchJson(`/api/collection?page=${page}&per_page=${perPage}`, 2);
        const chunk = Array.isArray(data.releases) ? data.releases : [];

        if (chunk.length) {
          collection = collection.concat(chunk);
          loadedItems = collection.length;

          if (typeof populateDecades === "function") populateDecades(collection);
          if (typeof populateLabels === "function") populateLabels(collection);
          if (typeof populateFormats === "function") populateFormats(collection);

          // Manteniamo filtri/ordinamento correnti
          applyAll();
        }

        await new Promise(r => setTimeout(r, 140));
      } catch {
        // non blocchiamo tutto se una pagina fallisce
        await new Promise(r => setTimeout(r, 250));
      }
    }

    // finito: nascondi loader
    const el = document.getElementById("loader");
    if (el) el.classList.add("hidden");
  })();
}`, 2);
  const page1 = Array.isArray(first.releases) ? first.releases : [];
  const pag = first.pagination || {};
  const pages = parseInt(pag.pages || 1, 10);

  collection = page1;
  filtered = [...collection];

  // mostra subito qualcosa
  applyAll();

  // carica il resto in background (progressivo)
  for (let page = 2; page <= pages; page++) {
    try {
      const data = await fetchJson(`/api/collection?page=${page}&per_page=${perPage}`, 2);
      const chunk = Array.isArray(data.releases) ? data.releases : [];
      collection = collection.concat(chunk);

      // aggiorna anche i menu (decenni/label/formati) man mano
      if (typeof populateDecades === "function") populateDecades(collection);
      if (typeof populateLabels === "function") populateLabels(collection);
      if (typeof populateFormats === "function") populateFormats(collection);

      // ricalcola i risultati senza bloccare troppo
      filtered = [...collection];
      applyAll();

      // piccola pausa per non stressare Discogs/browser
      await new Promise(r => setTimeout(r, 120));
    } catch {
      // se una pagina fallisce, continuiamo (non blocchiamo tutto)
    }
  }
}function applyAll() {
  const q = (document.getElementById("search").value || "").trim().toLowerCase();
  const genre = document.getElementById("genre").value;
  const style = document.getElementById("style").value;
  const sort = document.getElementById("sort").value;
  const decade = document.getElementById("decade").value;
  const label = document.getElementById("label").value;
  const format = document.getElementById("format").value;

  const yearFromRaw = document.getElementById("yearFrom").value;
  const yearToRaw = document.getElementById("yearTo").value;
  const yearFrom = yearFromRaw ? parseInt(yearFromRaw, 10) : null;
  const yearTo = yearToRaw ? parseInt(yearToRaw, 10) : null;
  const onlyFavs = document.getElementById("onlyFavs").checked;

  filtered = collection.filter(item => {
    const inQuery =
      !q ||
      (item.title || "").toLowerCase().includes(q) ||
      (item.artist || "").toLowerCase().includes(q);

    const inGenre = !genre || (item.genres || []).includes(genre);
    const inStyle = !style || (item.styles || []).includes(style);

    const y = item.year ? parseInt(item.year, 10) : null;

    const inYearFrom = yearFrom == null || (y != null && y >= yearFrom);
    const inYearTo = yearTo == null || (y != null && y <= yearTo);
    const inFav = !onlyFavs || favs.has(String(item.release_id));

    const inDecade = !decade || (y != null && Math.floor(y/10)*10 === parseInt(decade,10));
    const inLabel = !label || (item.labels || []).includes(label);
    const inFormat = !format ||function sortItems(items, sort) {
  const arr = [...items];

  if (sort === "fav_first") {
    arr.sort((a,b) => {
      const af = favs.has(String(a.release_id)) ? 1 : 0;
      const bf = favs.has(String(b.release_id)) ? 1 : 0;
      if (af !== bf) return bf - af;
      return (a.artist || "").localeCompare(b.artist || "") || (a.title || "").localeCompare(b.title || "");
    });
  }
  else if (sort === "artist") arr.sort((a,b) => (a.artist || "").localeCompare(b.artist || ""));
  else if (sort === "title") arr.sort((a,b) => (a.title || "").localeCompare(b.title || ""));
  else if (sort === "year_desc") arr.sort((a,b) => (b.year || 0) - (a.year || 0));
  else if (sort === "year_asc") arr.sort((a,b) => (a.year || 0) - (b.year || 0));

  return arr;
}

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


function populateDecades(items){
  const decadeEl = document.getElementById("decade");
  if (!decadeEl) return;

  const set = new Set();
  for (const it of items){
    const y = it.year ? parseInt(it.year, 10) : null;
    if (!y) continue;
    const d = Math.floor(y / 10) * 10;
    set.add(d);
  }

  const decades = Array.from(set).sort((a,b)=>a-b);

  // reset (lasciando la prima opzione)
  decadeEl.innerHTML = '<option value="">Tutti i decenni</option>';
  for (const d of decades){
    const opt = document.createElement("option");
    opt.value = String(d);
    opt.textContent = `${d}s`;
    decadeEl.appendChild(opt);
  }
}


function populateLabels(items){
  const el = document.getElementById("label");
  if (!el) return;

  const set = new Set();
  for (const it of items){
    for (const l of (it.labels || [])){
      if (l) set.add(String(l));
    }
  }
  const labels = Array.from(set).sort((a,b)=>a.localeCompare(b));

  el.innerHTML = '<option value="">Tutte le etichette</option>';
  for (const l of labels){
    const opt = document.createElement("option");
    opt.value = l;
    opt.textContent = l;
    el.appendChild(opt);
  }
}

function populateFormats(items){
  const el = document.getElementById("format");
  if (!el) return;

  const set = new Set();
  for (const it of items){
    for (const f of (it.formats || [])){
      if (f) set.add(String(f));
    }
  }
  const formats = Array.from(set).sort((a,b)=>a.localeCompare(b));

  el.innerHTML = '<option value="">Tutti i formati</option>';
  for (const f of formats){
    const opt = document.createElement("option");
    opt.value = f;
    opt.textContent = f;
    el.appendChild(opt);
  }
}


function updateLoaderProgress(extra=""){
  const el = document.getElementById("loader");
  if (!el) return;
  if (totalItems > 0){
    el.textContent = `Caricati ${loadedItems} / ${totalItems}… ${extra}`.trim();
  } else {
    el.textContent = `Caricamento collezione… ${extra}`.trim();
  }
}
