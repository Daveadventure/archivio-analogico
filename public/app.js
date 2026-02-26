



// Archivio Analogico - app.js (senza preferiti)

const grid = document.getElementById("grid");
const loaderEl = document.getElementById("loader");
const moreBtn = document.getElementById("more");

const elSearch = document.getElementById("search");
const elGenre = document.getElementById("genre");
const elStyle = document.getElementById("style");
const elDecade = document.getElementById("decade");
const elLabel = document.getElementById("label");
const elFormat = document.getElementById("format");
const elYearFrom = document.getElementById("yearFrom");
const elYearTo = document.getElementById("yearTo");
const elSort = document.getElementById("sort");
const elView = document.getElementById("view");
const elReset = document.getElementById("reset");

let collection = [];
let filtered = [];
let limit = 200;
let totalItems = 0;
let loadedItems = 0;

// Vista persistente
const VIEW_KEY = "aa_view_v1";
function loadView(){ return localStorage.getItem(VIEW_KEY) || "grid"; }
function saveView(v){ localStorage.setItem(VIEW_KEY, v); }
function applyView(v){ document.body.classList.toggle("view-list", v === "list"); }

// Utils
function debounce(fn, ms=250){
  let t=null;
  return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); };
}

async function fetchJson(url, tries=2) {
  let lastErr = null;
  for (let i=0;i<tries;i++){
    try{
      const r = await fetch(url, { cache: "no-store" });
      const ct = (r.headers.get("content-type") || "").toLowerCase();
      const raw = await r.text();
      const txt = (raw || "").trim();

      if (!txt) throw new Error(`Risposta vuota da ${url} (HTTP ${r.status})`);
      if (!ct.includes("application/json")) {
        const prev = txt.slice(0,180).replace(/\s+/g," ");
        throw new Error(`Risposta non-JSON da ${url} (HTTP ${r.status}): ${prev}`);
      }
      const data = JSON.parse(txt);
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status} da ${url}`);
      return data;
    } catch(e){
      lastErr = e;
      await new Promise(res=>setTimeout(res, 350));
    }
  }
  throw lastErr || new Error(`Errore fetchJson su ${url}`);
}

function updateLoader(extra=""){
  const bar = document.getElementById("progressBar");
  if (bar && totalItems > 0) {
    const pct = Math.max(0, Math.min(100, Math.round((loadedItems / totalItems) * 100)));
    bar.style.width = pct + "%";
  }
  if (!loaderEl) return;
  if (totalItems > 0) loaderEl.textContent = `Caricati ${loadedItems} / ${totalItems}… ${extra}`.trim();
  else loaderEl.textContent = `Caricamento collezione… ${extra}`.trim();
}

// Popola select da collezione
function populateDecades(items){
  if (!elDecade) return;
  const set = new Set();
  for (const it of items){
    const y = it.year ? parseInt(it.year,10) : null;
    if (!y) continue;
    set.add(Math.floor(y/10)*10);
  }
  const arr = Array.from(set).sort((a,b)=>a-b);
  elDecade.innerHTML = '<option value="">Tutti i decenni</option>';
  for (const d of arr){
    const o=document.createElement("option");
    o.value=String(d); o.textContent=`${d}s`;
    elDecade.appendChild(o);
  }
}
function populateLabels(items){
  if (!elLabel) return;
  const set = new Set();
  for (const it of items) for (const l of (it.labels||[])) if (l) set.add(String(l));
  const arr = Array.from(set).sort((a,b)=>a.localeCompare(b));
  elLabel.innerHTML = '<option value="">Tutte le etichette</option>';
  for (const v of arr){
    const o=document.createElement("option");
    o.value=v; o.textContent=v;
    elLabel.appendChild(o);
  }
}
function populateFormats(items){
  if (!elFormat) return;
  const set = new Set();
  for (const it of items) for (const f of (it.formats||[])) if (f) set.add(String(f));
  const arr = Array.from(set).sort((a,b)=>a.localeCompare(b));
  elFormat.innerHTML = '<option value="">Tutti i formati</option>';
  for (const v of arr){
    const o=document.createElement("option");
    o.value=v; o.textContent=v;
    elFormat.appendChild(o);
  }
}

function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function render(items){
  if (!grid) return;
  grid.innerHTML = "";
  const shown = items.slice(0, limit);

  for (const item of shown){
    const link = document.createElement("a");
    link.className = "cardlink";
    link.href = `/detail.html?id=${encodeURIComponent(String(item.release_id))}`;

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
  <div class="cover">
    <img loading="lazy" src="${esc(item.thumb || item.cover_image || "")}" alt="${esc(item.title)}" />
  </div>
  <div class="info">
    <div class="artist">${esc(item.artist)}</div>
    <div class="title">${esc(item.title)}</div>
    <div class="metaBadge">
  ${(() => {
    const parts = [];

    // ⭐ First Press (se anno uguale a min year disponibile — semplice e sicuro)
    if(item.first_pressing === true){
      parts.push('<span class="badgeStar">⭐</span>');
    }

    if(item.year) parts.push(esc(item.year));

    if(item.formats && item.formats.length){
      parts.push(esc(item.formats[0]));
    }

    if(item.country){
      parts.push(esc(item.country));
    }

    const formatsText = (item.formats || []).join(" ").toLowerCase();
    const descText = (item.format_descriptions || []).join(" ").toLowerCase();

    if(formatsText.includes("mono") || descText.includes("mono")){
      parts.push('<span class="badgeMono">Mono</span>');
    } else if(formatsText.includes("stereo") || descText.includes("stereo")){
      parts.push('<span class="badgeStereo">Stereo</span>');
    }

    return parts.join(" • ");
  })()}
</div>
  </div>
`;
    link.appendChild(card);
    grid.appendChild(link);
  }

  if (moreBtn) {
    if (items.length > limit) moreBtn.classList.remove("hidden");
    else moreBtn.classList.add("hidden");
  }

  if (loaderEl && loadedItems > 0) loaderEl.classList.add("hidden");
}

function sortItems(items, sort){
  const arr = [...items];

  const getYear = (item)=>{
    const y = parseInt(item.year, 10);
    return isNaN(y) ? 9999 : y; // se anno mancante va in fondo
  };

  const byArtistAZ = (a,b)=>
    (a.artist||"").localeCompare(b.artist||"") ||
    (a.title||"").localeCompare(b.title||"");

  const byTitleAZ = (a,b)=>
    (a.title||"").localeCompare(b.title||"");

  if (sort === "artist") return arr.sort(byArtistAZ);
  if (sort === "artist_desc") return arr.sort((a,b)=>-byArtistAZ(a,b));

  if (sort === "title") return arr.sort(byTitleAZ);
  if (sort === "title_desc") return arr.sort((a,b)=>-byTitleAZ(a,b));

  if (sort === "year") {
    // più recente prima
    return arr.sort((a,b)=> getYear(b) - getYear(a));
  }

  if (sort === "year_old") {
    // più vecchio prima
    return arr.sort((a,b)=> getYear(a) - getYear(b));
  }

  return arr.sort(byArtistAZ);
}

function applyAll(){



  const q = (elSearch?.value || "").trim().toLowerCase();
  const g = elGenre?.value || "";
  const st = elStyle?.value || "";
  const decade = elDecade?.value || "";
  const label = elLabel?.value || "";
  const format = elFormat?.value || "";

  const yfRaw = elYearFrom?.value || "";
  const ytRaw = elYearTo?.value || "";
  const yf = yfRaw ? parseInt(yfRaw,10) : null;
  const yt = ytRaw ? parseInt(ytRaw,10) : null;

  
const base = collection.filter(item=>{

    const inQuery = !q || (String(item.artist||"").toLowerCase().includes(q) || String(item.title||"").toLowerCase().includes(q));
    const inGenre = !g || (item.genres||[]).includes(g);
    const inStyle = !st || (item.styles||[]).includes(st);

    const y = item.year ? parseInt(item.year,10) : null;
    const inYearFrom = yf == null || (y != null && y >= yf);
    const inYearTo = yt == null || (y != null && y <= yt);

    const inDecade = !decade || (y != null && Math.floor(y/10)*10 === parseInt(decade,10));
    const inLabel = !label || (item.labels||[]).includes(label);
    const inFormat = !format || (item.formats||[]).includes(format);

    return inQuery && inGenre && inStyle && inYearFrom && inYearTo && inDecade && inLabel && inFormat;
  });

  const sort = elSort?.value || "artist";
  filtered = sortItems(base, sort);
  render(filtered);
  const tc=document.getElementById('totalCount');
  if(tc){ tc.textContent = filtered.length + ' dischi disponibili'; }


}

async function loadFilters(){
  const data = await fetchJson("/api/filters", 2);
  const genres = data.genres || [];
  const styles = data.styles || [];

  if (elGenre){
    elGenre.innerHTML = '<option value="">Tutti i generi</option>';
    for (const v of genres){
      const o=document.createElement("option"); o.value=v; o.textContent=v;
      elGenre.appendChild(o);
    }
  }
  if (elStyle){
    elStyle.innerHTML = '<option value="">Tutti gli stili</option>';
    for (const v of styles){
      const o=document.createElement("option"); o.value=v; o.textContent=v;
      elStyle.appendChild(o);
    }
  }
}

async function loadCollection(){
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

  (async ()=>{
    for (let page=2; page<=pages; page++){
      try{
        updateLoader(`(pagina ${page}/${pages})`);
        const data = await fetchJson(`/api/collection?page=${page}&per_page=${perPage}`, 2);
        const chunk = Array.isArray(data.releases) ? data.releases : [];
        if (chunk.length){
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

function wire(){
  const applyDebounced = debounce(()=>{ limit=200; applyAll(); }, 120);
  const applyNow = ()=>{ limit=200; applyAll(); };

  elSearch?.addEventListener("input", applyDebounced);
  elGenre?.addEventListener("change", applyNow);
  elStyle?.addEventListener("change", applyNow);
  elDecade?.addEventListener("change", applyNow);
  elLabel?.addEventListener("change", applyNow);
  elFormat?.addEventListener("change", applyNow);
  elYearFrom?.addEventListener("input", applyDebounced);
  elYearTo?.addEventListener("input", applyDebounced);
  elSort?.addEventListener("change", applyNow);

  elView?.addEventListener("change", ()=>{
    const v = elView.value;
    applyView(v);
    saveView(v);
  });

  elReset?.addEventListener("click", ()=>{
    if (elSearch) elSearch.value="";
    if (elGenre) elGenre.value="";
    if (elStyle) elStyle.value="";
    if (elDecade) elDecade.value="";
    if (elLabel) elLabel.value="";
    if (elFormat) elFormat.value="";
    if (elYearFrom) elYearFrom.value="";
    if (elYearTo) elYearTo.value="";
    if (elSort) elSort.value="added";
    limit=200;
    applyAll();
  });

  moreBtn?.addEventListener("click", ()=>{
    limit += 200;
    render(filtered);
  const tc=document.getElementById('totalCount');
  if(tc){ tc.textContent = filtered.length + ' dischi disponibili'; }


  });

  window.addEventListener("scroll", ()=>{
    const nearBottom = (window.innerHeight + window.scrollY) >= (document.body.offsetHeight - 700);
    if (nearBottom && moreBtn && !moreBtn.classList.contains("hidden")){
      limit += 200;
      render(filtered);
  const tc=document.getElementById('totalCount');
  if(tc){ tc.textContent = filtered.length + ' dischi disponibili'; }


    }
  });
}

(async function init(){
  try{
    updateLoader("");
    await loadFilters();

    if (elView){
      const v = loadView();
      elView.value = v;
      applyView(v);
    }

    wire();
    await loadCollection();
  } catch(e){
    if (loaderEl) loaderEl.textContent = "Errore: " + (e?.message || String(e));
  }
})();


// ===== DARK MODE TOGGLE =====
document.addEventListener("DOMContentLoaded", ()=>{
  const btn=document.getElementById("darkToggle");
  if(!btn) return;

  btn.addEventListener("click", ()=>{
    document.body.classList.toggle("darkMode");
  });
});


// ===== DARK MODE PERSISTENCE =====
document.addEventListener("DOMContentLoaded", ()=>{
  const saved=localStorage.getItem("darkMode");
  if(saved==="on"){
    document.body.classList.add("darkMode");
  }

  const btn=document.getElementById("darkToggle");
  if(btn){
    btn.addEventListener("click", ()=>{
      const active=document.body.classList.toggle("darkMode");
      localStorage.setItem("darkMode", active?"on":"off");
    });
  }
});



// ===== LISTENING ROOM TOGGLE (persistente) =====
document.addEventListener("DOMContentLoaded", ()=>{
  const saved = localStorage.getItem("darkMode");
  if (saved === "on") document.body.classList.add("darkMode");

  const btn = document.getElementById("darkToggle");
  if (!btn) return;

  btn.addEventListener("click", ()=>{
    const on = document.body.classList.toggle("darkMode");
    localStorage.setItem("darkMode", on ? "on" : "off");
  });
});


// ===== QUICK DECADE FILTER =====
document.addEventListener("DOMContentLoaded", ()=>{
  document.querySelectorAll(".quickDecades button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const decade = btn.dataset.decade;

      if(!decade){
        elDecade.value = "";
      }else if(decade === "2000"){
        elYearFrom.value = 2000;
        elYearTo.value = "";
        elDecade.value = "";
      }else{
        elYearFrom.value = decade;
        elYearTo.value = parseInt(decade)+9;
        elDecade.value = "";
      }

      applyAll();
    });
  });
});
