let db = [];
let activeView = "all";
let activeTipo = "all";
let activeTool = "all";
let searchTerm = "";

const TOOL_COLORS = {
  Smartsheet: "#0F6E56",
  "Power BI": "#185FA5",
  Excel: "#1A5C38",
  "Power Query": "#5B4FD4",
  "Virtus Flow": "#854F0B",
  "Power Automate": "#791F1F",
};

const TIPO_COLORS = {
  "Best Practice": "#0F6E56",
  "Issue - Workaround": "#854F0B",
  Template: "#185FA5",
};

const elements = {
  tipoFilters: document.querySelector("#tipo-filters"),
  toolFilters: document.querySelector("#tool-filters"),
  sidebarFooter: document.querySelector("#sidebarFooter"),
  statsBar: document.querySelector("#statsBar"),
  mainArea: document.querySelector("#mainArea"),
  searchInput: document.querySelector("#searchInput"),
  searchClear: document.querySelector("#searchClear"),
  aiInput: document.querySelector("#aiInput"),
  fileBadge: document.querySelector("#fileBadge"),
  reloadButton: document.querySelector("#reload-button"),
  exportButton: document.querySelector("#export-button"),
  aiButton: document.querySelector("#ai-button"),
};

function toolColor(tool) {
  for (const key in TOOL_COLORS) {
    if (tool && tool.includes(key)) {
      return TOOL_COLORS[key];
    }
  }
  return "#6B665E";
}

function tipoColor(tipo) {
  for (const key in TIPO_COLORS) {
    if (tipo && tipo.includes(key)) {
      return TIPO_COLORS[key];
    }
  }
  return "#6B665E";
}

function tipoBadge(tipo) {
  if (!tipo) return "badge-other";
  if (tipo.includes("Best Practice")) return "badge-bp";
  if (tipo.includes("Issue")) return "badge-iw";
  if (tipo.includes("Template")) return "badge-tpl";
  return "badge-other";
}

function stableViews(item, index) {
  const seed = `${item.tag}|${item.desc}|${item.strumento}|${index}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  }
  return 5 + (hash % 80);
}

function normalizeEntry(entry, index) {
  return {
    id: entry.id || String(index + 1),
    tag: String(entry.tag || "").trim(),
    desc: String(entry.desc || "").trim(),
    query: String(entry.query || "").trim(),
    tipo: String(entry.tipo || "").trim(),
    strumento: String(entry.strumento || "").trim(),
    autore: String(entry.autore || "").trim(),
    tagRicerca: String(entry.tagRicerca || "").trim(),
    views: stableViews(entry, index),
  };
}

async function loadKnowledgeHub() {
  renderLoading();
  elements.reloadButton.disabled = true;

  try {
    const response = await fetch("/api/smartsheet");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || `Errore ${response.status}`);
    }

    db = (data.sheet?.entries || []).map(normalizeEntry);
    activeView = "all";
    activeTipo = "all";
    activeTool = "all";
    searchTerm = "";
    elements.searchInput.value = "";
    elements.searchClear.style.display = "none";
    elements.fileBadge.style.display = "inline-flex";
    elements.sidebarFooter.textContent = `${data.workspace?.name || "Workspace"} · ${data.sheet?.name || "Knowledge Hub"}`;

    buildFilters();
    updateStats();
    render();
    showToast(`${db.length} risorse caricate da Smartsheet`);
  } catch (error) {
    db = [];
    buildFilters();
    updateStats();
    renderError(error.message);
  } finally {
    elements.reloadButton.disabled = false;
  }
}

function uniqueVals(key) {
  const values = new Set();
  db.forEach((item) => {
    if (!item[key]) return;
    item[key].split(/[,;/]/).forEach((value) => {
      const cleaned = value.trim();
      if (cleaned) values.add(cleaned);
    });
  });
  return [...values].sort();
}

function countByExact(key, value) {
  return db.filter((item) => item[key] === value).length;
}

function countByIncludes(key, value) {
  return db.filter((item) => item[key] && item[key].includes(value)).length;
}

function buildFilters() {
  const tipos = uniqueVals("tipo");
  elements.tipoFilters.innerHTML = [
    filterButton("tipo", "all", "Tutte", "#A09A91", db.length, activeTipo === "all"),
    ...tipos.map((tipo) => filterButton("tipo", tipo, tipo, tipoColor(tipo), countByExact("tipo", tipo), activeTipo === tipo)),
  ].join("");

  const tools = uniqueVals("strumento");
  elements.toolFilters.innerHTML = [
    filterButton("tool", "all", "Tutti", "#A09A91", db.length, activeTool === "all"),
    ...tools.map((tool) => filterButton("tool", tool, tool, toolColor(tool), countByIncludes("strumento", tool), activeTool === tool)),
  ].join("");

  document.querySelectorAll("[data-tipo]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTipo = button.dataset.tipo;
      buildFilters();
      render();
    });
  });

  document.querySelectorAll("[data-tool]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTool = button.dataset.tool;
      buildFilters();
      render();
    });
  });
}

function filterButton(kind, value, label, color, count, active) {
  return `
    <button class="filter-item ${active ? "active" : ""}" type="button" data-${kind}="${escAttr(value)}">
      <span class="filter-dot" style="background:${color}"></span>
      <span class="filter-name">${escHtml(label)}</span>
      <span class="filter-count">${count}</span>
    </button>`;
}

function setView(view) {
  activeView = view;
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  render();
}

function getFiltered() {
  let items = [...db];

  if (activeTipo !== "all") {
    items = items.filter((item) => item.tipo === activeTipo);
  }

  if (activeTool !== "all") {
    items = items.filter((item) => item.strumento && item.strumento.includes(activeTool));
  }

  if (activeView === "popular") {
    items = items.slice().sort((a, b) => b.views - a.views).slice(0, 10);
  }

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    items = items.filter((item) =>
      [item.desc, item.tag, item.query, item.tipo, item.strumento, item.autore, item.tagRicerca]
        .some((value) => String(value || "").toLowerCase().includes(term)),
    );
  }

  const sort = document.querySelector("#sortSelect")?.value || "default";
  if (sort === "views") {
    items.sort((a, b) => b.views - a.views);
  }

  return items;
}

function updateStats() {
  const tools = new Set(db.map((item) => item.strumento).filter(Boolean)).size;
  elements.statsBar.innerHTML = `
    <div class="stat-pill"><strong>${db.length}</strong> risorse totali</div>
    <div class="stat-pill"><strong>${db.filter((item) => item.tipo === "Best Practice").length}</strong> best practice</div>
    <div class="stat-pill"><strong>${db.filter((item) => item.query).length}</strong> con formula/query</div>
    <div class="stat-pill"><strong>${tools}</strong> strumenti</div>`;
}

function render() {
  if (!db.length) {
    renderEmpty();
    return;
  }

  const filtered = getFiltered();
  elements.mainArea.innerHTML = `
    <div class="content-header">
      <div class="results-info" id="resultsInfo"></div>
      <div class="sort-wrap">
        Ordina per
        <select id="sortSelect">
          <option value="default">Pertinenza</option>
          <option value="views">Più visualizzate</option>
        </select>
      </div>
    </div>
    <div class="cards" id="cards"></div>`;

  document.querySelector("#sortSelect").addEventListener("change", render);
  document.querySelector("#resultsInfo").innerHTML = searchTerm
    ? `<strong>${filtered.length}</strong> risultati per "<strong>${escHtml(searchTerm)}</strong>"`
    : `<strong>${filtered.length}</strong> risorse`;

  const cards = document.querySelector("#cards");
  if (!filtered.length) {
    cards.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">○</div>
        <h3>Nessun risultato</h3>
        <p>Prova con termini diversi o cambia i filtri.</p>
      </div>`;
    return;
  }

  cards.innerHTML = filtered.map(cardTemplate).join("");

  document.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", () => toggleCard(card.dataset.id));
  });

  document.querySelectorAll("[data-copy-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      copyItem(button.dataset.copyId);
    });
  });
}

function cardTemplate(item, index) {
  const title = item.desc.length > 180 ? `${item.desc.substring(0, 180)}...` : item.desc;
  const toolLabel = item.strumento.length > 28 ? `${item.strumento.substring(0, 28)}...` : item.strumento;

  return `
    <article class="card" id="card-${escAttr(item.id)}" data-id="${escAttr(item.id)}" style="animation-delay:${Math.min(index, 12) * 0.03}s">
      <div class="card-head">
        <div class="card-title">${highlight(title, searchTerm)}</div>
        <div class="card-badges">
          ${item.tipo ? `<span class="badge ${tipoBadge(item.tipo)}">${escHtml(item.tipo)}</span>` : ""}
          ${item.strumento ? `<span class="badge badge-tool" style="background:${toolColor(item.strumento)}1A;color:${toolColor(item.strumento)}">${escHtml(toolLabel)}</span>` : ""}
          <span class="expand-icon">▾</span>
        </div>
      </div>
      <div class="card-meta">
        ${item.tag ? `<span class="meta-item">Tag: ${escHtml(item.tag)}</span>` : ""}
        ${item.autore ? `<span class="meta-item">Autore: ${escHtml(item.autore.split("@")[0])}</span>` : ""}
        ${item.query ? `<span class="meta-item">Formula/Query presente</span>` : ""}
        <span class="meta-item">${item.views} viste</span>
      </div>
      <div class="card-detail">
        <div class="detail-label">Descrizione completa</div>
        <p class="detail-text">${escHtml(item.desc).replace(/\n/g, "<br>")}</p>
        ${item.query ? `<div class="detail-label with-gap">Formula / Query</div><div class="card-detail-code">${escHtml(item.query)}</div>` : ""}
        <div class="card-detail-actions">
          <button class="card-action" type="button" data-copy-id="${escAttr(item.id)}">Copia ${item.query ? "query" : "testo"}</button>
        </div>
      </div>
    </article>`;
}

function renderLoading() {
  elements.mainArea.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">↻</div>
      <h3>Caricamento da Smartsheet</h3>
      <p>Lettura del foglio Knowledge Hub nel workspace configurato.</p>
    </div>`;
}

function renderEmpty() {
  elements.mainArea.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">□</div>
      <h3>Nessuna risorsa disponibile</h3>
      <p>Il foglio Smartsheet non contiene ancora righe compatibili.</p>
    </div>`;
}

function renderError(message) {
  elements.sidebarFooter.textContent = "Errore connessione";
  elements.mainArea.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">!</div>
      <h3>Impossibile caricare Smartsheet</h3>
      <p>${escHtml(message)}</p>
    </div>`;
  showToast("Errore durante il caricamento da Smartsheet");
}

function toggleCard(id) {
  const card = document.querySelector(`#card-${CSS.escape(id)}`);
  card.classList.toggle("open");

  if (card.classList.contains("open")) {
    const item = db.find((entry) => entry.id === id);
    if (item) item.views += 1;
  }
}

function onSearch(value) {
  searchTerm = value;
  elements.searchClear.style.display = value ? "flex" : "none";
  render();
}

function clearSearch() {
  elements.searchInput.value = "";
  onSearch("");
}

function copyItem(id) {
  const item = db.find((entry) => entry.id === id);
  if (!item) return;
  navigator.clipboard.writeText(item.query || item.desc).then(() => showToast("Copiato negli appunti"));
}

function exportData() {
  if (!db.length) {
    showToast("Nessun dato da esportare");
    return;
  }

  const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "knowledge-base-export.json";
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Esportazione completata");
}

function sendAiQuery() {
  const query = elements.aiInput.value.trim();
  if (!query) return;
  if (!db.length) {
    showToast("Carica prima i dati da Smartsheet");
    return;
  }

  const terms = query.toLowerCase().split(" ").filter((word) => word.length > 3);
  const matches = db.filter((item) =>
    terms.some((word) =>
      [item.desc, item.tag, item.query, item.strumento].some((value) => String(value || "").toLowerCase().includes(word)),
    ),
  );

  if (matches.length) {
    const keyword = terms.sort((a, b) => b.length - a.length)[0];
    elements.searchInput.value = keyword;
    onSearch(keyword);
    showToast(`Trovate ${matches.length} risorse pertinenti`);
  } else {
    showToast("Nessuna risorsa trovata. Prova con altre parole.");
  }
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2800);
}

function highlight(text, term) {
  if (!term || !text) {
    return escHtml(text || "");
  }

  const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${safeTerm})`, "gi");
  return escHtml(text).replace(regex, '<span class="highlight">$1</span>');
}

function escHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escAttr(value) {
  return escHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

elements.searchInput.addEventListener("input", () => onSearch(elements.searchInput.value));
elements.searchClear.addEventListener("click", clearSearch);
elements.reloadButton.addEventListener("click", loadKnowledgeHub);
elements.exportButton.addEventListener("click", exportData);
elements.aiButton.addEventListener("click", sendAiQuery);
elements.aiInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendAiQuery();
  }
});

loadKnowledgeHub();
