// Archivio Analogico - app.js (pulito)
// Debug helper (se presente)
const DBG = (msg) => { try { window.__AA_DEBUG__ && __AA_DEBUG__(msg); } catch {} };

DBG("DEBUG: app.js caricato ✅");

// DOM
const grid = document.getElementById("grid");
const loaderEl = document.getElementById("loader");
const moreBtn = document.getElementById("more");

// Controls (possono non esistere in alcune versioni)
const elSearch = document.getElementById("search");
const elGenre = document.getElementById("genre");
const elStyle = document.getElementById("style");
const elDecade = document.getElementById("decade");
const elLabel = document.getElementById("label");
const elFormat = document.getElementById("format");
const elYearFrom = document.getElementById("yearFrom");
const elYearTo = document.getElementById("yearTo");
const elOnlyFavs = document.getElementById("onlyFavs");
const elSort = document.getElementById("sort");
const elView = document.getElementById("view");
const elReset = document.getElementById("reset");

// State
let collection = [];
let filtered = [];
let limit = 200;
let totalItems = 0;
let loadedItems = 0;

// View persistence
const VIEW_KEY = "aa_view_v1";
function loadView() { return localStorage.getItem(VIEW_KEY) || "grid"; }
function saveView(v) { localStorage.setItem(VIEW_KEY, v); }
function applyView(v) { document.body.classList.toggle("view-list", v === "list"); }

// Favorites local
const FAV_KEY = "aa_favs_v1";
function loadFavs() {
  try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]").map(String)); }
  catch { return new Set(); }
}
function saveFavs(set) { localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(set))); }
let favs = loadFavs();

// Loader progress
function updateLoader(extra="") {
  if (!loaderEl) return;
  if (totalItems > 0) loaderEl.textContent = `Caricati ${loadedItems} / ${totalItems}… ${extra}`.trim();
  else loaderEl.textContent = `Caricamento collezione… ${extra}`.trim();
}

// Utils
function debounce(fn, ms=250) {
  let t = null;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function fetchJson(url, tries=2) {
  let lastErr = null;
  for (let i=0; i<tries; i++) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      const txt = await r.text();
      if (!txt) throw new Error("Risposta vuota");
      const data = JSON.parse(txt);
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      return data;
    } catch (e) {
      lastErr = e;
      await new Promise(res => setTimeout(res, 250));
    }
  }
  throw lastErr || new Error("Errore fetchJson");
}

// Supabase sync (best effort)
async function syncFavsFromServer() {
  try {
    const data = await fetchJson("/api/favorites", 2);
    const serverIds = new Set((data.ids || []).map(String));
    for (const id of favs) serverIds.add(String(id));
    favs = serverIds;
    saveFavs(favs);

    // upsert locali mancanti (best effort)
    for (const id of favs) {
      fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      }).catch(()=>{});
    }
  } catch {
    // offline: ok
  }
}

async function setFavOnServer(id, isFav) {
  try {
    if (isFav) {
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: String(id) })
      });
    } else {
      await fetch("/api/favorites?id=" + encodeURIComponent(String(id)), { method: "DELETE" });
    }
  } catch {
    // best effort
  }
}

// Populate selects derived from collection
function populateDecades(items) {
  if (!elDecade) return;
  const set = new Set();
  for (const it of items) {
    const y = it.year ? parseInt(it.year, 10) : null;
    if (!y) continue;
    set.add(Math.floor(y/10)*10);
  }
  const decades = Array.from(set).sort((a,b)=>a-b);
  elDecade.innerHTML = '<option value="">Tutti i decenni</option>';
  for (const d of decades) {
    const o = document.createElement("option");
    o.value = String(d);
    o.textContent = `${d}s`;
    elDecade.appendChild(o);
  }
}
function populateLabels(items) {
  if (!elLabel) return;
  const set = new Set();
  for (const it of items) for (const l of (it.labels || [])) if (l) set.add(String(l));
  const arr = Array.from(set).sort((a,b)=>a.localeCompare(b));
  elLabel.innerHTML = '<option value="">Tutte le etichette</option>';
  for (const v of arr) {
    const o = document.createElement("option");
    o.value = v; o.textContent = v;
    elLabel.appendChild(o);
  }
}
function populateFormats(items) {
  if (!elFormat) return;
  const set = new Set();
  for (const it of items) for (const f of (it.formats || [])) if (f) set.add(String(f));
  const arr = Array.from(set).sort((a,b)=>a.localeCompare(b));
  elFormat.innerHTML = '<option value="">Tutti i formati</option>';
  for (const v of arr) {
    const o = document.createElement("option");
    o.value = v; o.textContent = v;
    elFormat.appendChild(o);
  }
}

// Rendering
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function render(items) {
  if (!grid) return;
  grid.innerHTML = "";

  const shown = items.slice(0, limit);
  for (const item of shown) {
    const link = document.createElement("a");
    link.className = "cardlink";
    link.href = `/detail.html?id=${encodeURIComponent(String(item.release_id))}`;

    const card = document.createElement("div");
    card.className = "card";

    const idStr = String(item.release_id);
    const isFav = favs.has(idStr);

    card.innerHTML = `
      <button class="favbtn" type="button" title="Preferito" aria-label="Preferito">${isFav ? "★" : "☆"}</button>
      <div class="cover">
        <img loading="lazy" src="${esc(item.thumb || item.cover_image || "")}" alt="${esc(item.title)}" />
      </div>
      <div class="info">
        <div class="artist">${esc(item.artist)}</div>
        <div class="title">${esc(item.title)}</div>
        <div class="meta2">${esc(item.year || "")}</div>
      </div>
    `;

    const favBtn = card.querySelector(".favbtn");
    favBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (favs.has(idStr)) favs.delete(idStr);
      else favs.add(idStr);
      saveFavs(favs);
      const nowFav = favs.has(idStr);
      favBtn.textContent = nowFav ? "★" : "☆";
      setFavOnServer(idStr, nowFav);
      if (elOnlyFavs?.checked) applyAll();
    });

    link.appendChild(card);
    grid.appendChild(link);
  }

  // more button visibility (still useful even with infinite scroll)
  if (moreBtn) {
    if (items.length > limit) moreBtn.classList.remove("hidden");
    else moreBtn.classList.add("hidden");
  }
}

// Filtering & sorting
function sortItems(items, sort) {
  const arr = [...items];
  if (sort === "fav_first") {
    arr.sort((a,b) => {
      const af = favs.has(String(a.release_id)) ? 1 : 0;
      const bf = favs.has(String(b.release_id)) ? 1 : 0;
      if (af !== bf) return bf - af;
      return (a.artist||"").localeCompare(b.artist||"") || (a.title||"").localeCompare(b.title||"");
    });
    return arr;
  }
  if (sort === "artist") {
    arr.sort((a,b)=>(a.artist||"").localeCompare(b.artist||"") || (a.title||"").localeCompare(b.title||""));
    return arr;
  }
  if (sort === "title") {
    arr.sort((a,b)=>(a.title||"").localeCompare(b.title||""));
    return arr;
  }
  if (sort === "year") {
    arr.sort((a,b)=> (parseInt(b.year||0,10)||0) - (parseInt(a.year||0,10)||0));
    return arr;
  }
  // default "added": manteniamo ordine ricevuto
  return arr;
}

function applyAll() {
  const q = (elSearch?.value || "").trim().toLowerCase();
  const g = elGenre?.value || "";
  const st = elStyle?.value || "";
  const decade = elDecade?.value || "";
  const label = elLabel?.value || "";
  const format = elFormat?.value || "";
  const onlyFavs = !!elOnlyFavs?.checked;

  const yfRaw = elYearFrom?.value || "";
  const ytRaw = elYearTo?.value || "";
  const yf = yfRaw ? parseInt(yfRaw, 10) : null;
  const yt = ytRaw ? parseInt(ytRaw, 10) : null;

  const base = collection.filter(item => {
    const inQuery = !q || (String(item.artist||"").toLowerCase().includes(q) || String(item.title||"").toLowerCase().includes(q));
    const inGenre = !g || (item.genres||[]).includes(g);
    const inStyle = !st || (item.styles||[]).includes(st);

    const y = item.year ? parseInt(item.year, 10) : null;
    const inYearFrom = yf == null || (y != null && y >= yf);
    const inYearTo = yt == null || (y != null && y <= yt);

    const inDecade = !decade || (y != null && Math.floor(y/10)*10 === parseInt(decade,10));
    const inLabel = !label || (item.labels||[]).includes(label);
    const inFormat = !format || (item.formats||[]).includes(format);
    const inFav = !onlyFavs || favs.has(String(item.release_id));

    return inQuery && inGenre && inStyle && inYearFrom && inYearTo && inDecade && inLabel && inFormat && inFav;
  });

  const sort = elSort?.value || "added";
  filtered = sortItems(base, sort);
  render(filtered);

  // loader hide when at least something loaded
  if (loaderEl && loadedItems > 0) loaderEl.classList.add("hidden");
}

// Load filters from /api/filters
async function loadFilters() {
  const data = await fetchJson("/api/filters", 2);
  const genres = data.genres || [];
  const styles = data.styles || [];

  if (elGenre) {
    elGenre.innerHTML = '<option value="">Tutti i generi</option>';
    for (const v of genres) {
      const o = document.createElement("option"); o.value = v; o.textContent = v;
      elGenre.appendChild(o);
    }
  }
  if (elStyle) {
    elStyle.innerHTML = '<option value="">Tutti gli stili</option>';
    for (const v of styles) {
      const o = document.createElement("option"); o.value = v; o.textContent = v;
      elStyle.appendChild(o);
    }
  }
}

// Load collection paginated: show page 1 immediately, rest in background
async function loadCollection() {
  const perPage = 100;
  updateLoader("");

  const first = await fetchJson(`/api/collection?page=1&per_page=${perPage}`, 2);
  const page1 = Array.isArray(first.releases) ? first.releases : [];
  const pag = first.pagination || {};
  const pages = parseInt(pag.pages || 1, 10);
  totalItems = parseInt(pag.items || 0, 10) || 0;

  collection = page1;
  loadedItems = collection.length;

  populateDecades(collection);
  populateLabels(collection);
  populateFormats(collection);

  applyAll();
  updateLoader(`(pagina 1/${pages})`);

  // background load
  (async () => {
    for (let page=2; page<=pages; page++) {
      try {
        updateLoader(`(pagina ${page}/${pages})`);
        const data = await fetchJson(`/api/collection?page=${page}&per_page=${perPage}`, 2);
        const chunk = Array.isArray(data.releases) ? data.releases : [];
        if (chunk.length) {
          collection = collection.concat(chunk);
          loadedItems = collection.length;
          populateDecades(collection);
          populateLabels(collection);
          populateFormats(collection);
          applyAll();
        }
        await new Promise(r=>setTimeout(r, 140));
      } catch {
        await new Promise(r=>setTimeout(r, 250));
      }
    }
    if (loaderEl) loaderEl.classList.add("hidden");
  })();
}

// Wire events
function wire() {
  const applyDebounced = debounce(() => { limit = 200; applyAll(); }, 220);
  const applyNow = () => { limit = 200; applyAll(); };

  elSearch?.addEventListener("input", applyDebounced);
  elGenre?.addEventListener("change", applyNow);
  elStyle?.addEventListener("change", applyNow);
  elDecade?.addEventListener("change", applyNow);
  elLabel?.addEventListener("change", applyNow);
  elFormat?.addEventListener("change", applyNow);
  elYearFrom?.addEventListener("input", applyDebounced);
  elYearTo?.addEventListener("input", applyDebounced);
  elOnlyFavs?.addEventListener("change", applyNow);
  elSort?.addEventListener("change", applyNow);

  elView?.addEventListener("change", () => {
    const v = elView.value;
    applyView(v);
    saveView(v);
  });

  elReset?.addEventListener("click", () => {
    if (elSearch) elSearch.value = "";
    if (elGenre) elGenre.value = "";
    if (elStyle) elStyle.value = "";
    if (elDecade) elDecade.value = "";
    if (elLabel) elLabel.value = "";
    if (elFormat) elFormat.value = "";
    if (elYearFrom) elYearFrom.value = "";
    if (elYearTo) elYearTo.value = "";
    if (elOnlyFavs) elOnlyFavs.checked = false;
    if (elSort) elSort.value = "added";
    limit = 200;
    applyAll();
  });

  moreBtn?.addEventListener("click", () => {
    limit += 200;
    render(filtered);
  });

  window.addEventListener("scroll", () => {
    const nearBottom = (window.innerHeight + window.scrollY) >= (document.body.offsetHeight - 700);
    if (nearBottom && moreBtn && !moreBtn.classList.contains("hidden")) {
      limit += 200;
      render(filtered);
    }
  });
}

// Init
(async function init() {
  try {
    updateLoader("");
    await loadFilters();

    // view
    if (elView) {
      const v = loadView();
      elView.value = v;
      applyView(v);
    }

    await loadCollection();
    await syncFavsFromServer();

    // re-render to reflect server favs
    applyAll();
  } catch (e) {
    if (loaderEl) loaderEl.textContent = "Errore: " + (e?.message || String(e));
    DBG("JS ERROR INIT: " + (e?.message || String(e)));
  }
})();
