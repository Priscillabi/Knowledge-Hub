let db = [];
let activeView = "all";
let activeTipo = "all";
let activeTool = "all";
let activeFacet = {
  section: null,
  value: null,
};
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

const FACET_CONFIG = [
  {
    sectionName: "Smartsheet",
    columns: ["Smartsheet - tecnica"],
  },
  {
    sectionName: "Power BI",
    columns: ["Power BI - tecnica"],
  },
  {
    sectionName: "Power Query",
    columns: ["Power Query - tecnica"],
  },
  {
    sectionName: "Excel",
    columns: ["Excel - tecnica"],
  },
  {
    sectionName: "Virtus Flow",
    columns: ["Virtus Flow - tecnica"],
  },
  {
    sectionName: "Power Automate",
    columns: ["Power Automate - tecnica"],
  },
];

const elements = {
  tipoFilters: document.querySelector("#tipo-filters"),
  toolFilters: document.querySelector("#tool-filters"),
  facetFilters: document.querySelector("#facet-filters"),
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

function splitValues(value) {
  return String(value || "")
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
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
    workaround: String(entry.workaround || "").trim(),
    technical: entry.technical || {},
    attachments: Array.isArray(entry.attachments) ? entry.attachments : [],
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
    activeFacet = { section: null, value: null };
    searchTerm = "";
    elements.searchInput.value = "";
    elements.searchClear.style.display = "none";
    elements.fileBadge.style.display = "inline-flex";
    elements.sidebarFooter.textContent = `${data.workspace?.name || "Workspace"} - ${data.sheet?.name || "Knowledge Hub"}`;

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
    splitValues(item[key]).forEach((value) => values.add(value));
  });
  return [...values].sort();
}

function itemHasSplitValue(item, key, value) {
  return splitValues(item[key]).includes(value);
}

function itemFacetValues(item, sectionName, columns = []) {
  const section = item.technical?.[sectionName] || {};
  const values = new Set();
  const sourceValues = columns.length ? columns.map((column) => section[column]) : Object.values(section);

  sourceValues.forEach((value) => {
    splitValues(value).forEach((part) => values.add(part));
  });
  return values;
}

function itemHasFacetValue(item, sectionName, value) {
  const config = FACET_CONFIG.find((facet) => facet.sectionName === sectionName);
  return itemFacetValues(item, sectionName, config?.columns || []).has(value);
}

function buildFilters() {
  const tipos = uniqueVals("tipo");
  elements.tipoFilters.innerHTML = [
    filterButton("tipo", "all", "Tutte", "#A09A91", db.length, activeTipo === "all"),
    ...tipos.map((tipo) =>
      filterButton("tipo", tipo, tipo, tipoColor(tipo), db.filter((item) => itemHasSplitValue(item, "tipo", tipo)).length, activeTipo === tipo),
    ),
  ].join("");

  const tools = uniqueVals("strumento");
  elements.toolFilters.innerHTML = [
    filterButton("tool", "all", "Tutti", "#A09A91", db.length, activeTool === "all"),
    ...tools.map((tool) =>
      filterButton("tool", tool, tool, toolColor(tool), db.filter((item) => itemHasSplitValue(item, "strumento", tool)).length, activeTool === tool),
    ),
  ].join("");

  elements.facetFilters.innerHTML = buildFacetSections();

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

  document.querySelectorAll("[data-facet-section]").forEach((button) => {
    button.addEventListener("click", () => {
      const section = button.dataset.facetSection;
      const value = button.dataset.facetValue;

      if (activeFacet.section === section && activeFacet.value === value) {
        activeFacet = { section: null, value: null };
      } else {
        activeFacet = { section, value };
      }

      buildFilters();
      render();
    });
  });
}

function buildFacetSections() {
  return FACET_CONFIG.map((config) => buildFacetFilters(config.sectionName, config.columns))
    .filter(Boolean)
    .join("");
}

function buildFacetFilters(sectionName, columns) {
  const counts = new Map();

  db.forEach((item) => {
    itemFacetValues(item, sectionName, columns).forEach((value) => {
      counts.set(value, (counts.get(value) || 0) + 1);
    });
  });

  const values = [...counts.keys()].sort();
  if (!values.length) {
    return "";
  }

  return `
    <div class="nav-sep"></div>
    <div class="nav-label">${escHtml(sectionName)}</div>
    ${values
      .map((value) =>
        filterButton(
          "facet",
          value,
          value,
          toolColor(sectionName),
          counts.get(value),
          activeFacet.section === sectionName && activeFacet.value === value,
          sectionName,
        ),
      )
      .join("")}`;
}

function filterButton(kind, value, label, color, count, active, sectionName = "") {
  if (kind === "facet") {
    return `
      <button class="filter-item ${active ? "active" : ""}" type="button" data-facet-section="${escAttr(sectionName)}" data-facet-value="${escAttr(value)}">
        <span class="filter-dot" style="background:${color}"></span>
        <span class="filter-name">${escHtml(label)}</span>
        <span class="filter-count">${count}</span>
      </button>`;
  }

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
    items = items.filter((item) => itemHasSplitValue(item, "tipo", activeTipo));
  }

  if (activeTool !== "all") {
    items = items.filter((item) => itemHasSplitValue(item, "strumento", activeTool));
  }

  if (activeFacet.section && activeFacet.value) {
    items = items.filter((item) => itemHasFacetValue(item, activeFacet.section, activeFacet.value));
  }

  if (activeView === "popular") {
    items = items.slice().sort((a, b) => b.views - a.views).slice(0, 10);
  }

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    items = items.filter((item) =>
      searchableValues(item).some((value) => String(value || "").toLowerCase().includes(term)),
    );
  }

  const sort = document.querySelector("#sortSelect")?.value || "default";
  if (sort === "views") {
    items.sort((a, b) => b.views - a.views);
  }

  return items;
}

function searchableValues(item) {
  const technicalValues = Object.values(item.technical || {}).flatMap((section) => Object.values(section || {}));
  const attachmentNames = item.attachments.map((attachment) => attachment.name);
  return [
    item.desc,
    item.workaround,
    item.tag,
    item.query,
    item.tipo,
    item.strumento,
    item.autore,
    item.tagRicerca,
    ...technicalValues,
    ...attachmentNames,
  ];
}

function updateStats() {
  const tools = new Set(db.flatMap((item) => splitValues(item.strumento))).size;
  elements.statsBar.innerHTML = `
    <div class="stat-pill"><strong>${db.length}</strong> risorse totali</div>
    <div class="stat-pill"><strong>${db.filter((item) => itemHasSplitValue(item, "tipo", "Best Practice")).length}</strong> best practice</div>
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
          <option value="views">Piu visualizzate</option>
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
        <div class="empty-icon">0</div>
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

  document.querySelectorAll("[data-open-attachment-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openAttachment(button);
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
          ${item.attachments.length ? `<span class="badge badge-attachment">${item.attachments.length} allegati</span>` : ""}
          <span class="expand-icon">v</span>
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
        ${item.workaround ? `<div class="detail-label with-gap">Workaround</div><p class="detail-text">${escHtml(item.workaround).replace(/\n/g, "<br>")}</p>` : ""}
        ${renderTechnicalDetails(item)}
        ${item.query ? `<div class="detail-label with-gap">Formula / Query</div><div class="card-detail-code">${escHtml(item.query)}</div>` : ""}
        ${renderAttachments(item.attachments)}
        <div class="card-detail-actions">
          <button class="card-action" type="button" data-copy-id="${escAttr(item.id)}">Copia ${item.query ? "query" : "testo"}</button>
        </div>
      </div>
    </article>`;
}

function renderTechnicalDetails(item) {
  const chips = FACET_CONFIG.flatMap((config) =>
    [...itemFacetValues(item, config.sectionName, config.columns)].map((value) => ({
      sectionName: config.sectionName,
      value,
    })),
  );

  if (!chips.length) {
    return "";
  }

  return `
    <div class="detail-label with-gap">Funzionalita tecniche</div>
    <div class="technical-chips">
      ${chips.map((chip) => `<span class="technical-chip">${escHtml(chip.sectionName)}: ${escHtml(chip.value)}</span>`).join("")}
    </div>`;
}

function renderAttachments(attachments) {
  if (!attachments.length) {
    return "";
  }

  return `
    <div class="detail-label with-gap">Allegati</div>
    <div class="attachments-list">
      ${attachments.map(attachmentTemplate).join("")}
    </div>
    <p class="attachment-note">Il link viene richiesto a Smartsheet al momento dell'apertura e puo essere temporaneo.</p>`;
}

function attachmentTemplate(attachment) {
  const extension = fileExtension(attachment.name) || attachment.mimeType || attachment.attachmentType || "file";
  const size = attachment.sizeInKb ? `${Math.round(attachment.sizeInKb)} KB` : "";
  const meta = [extension, size].filter(Boolean).join(" - ");

  return `
    <div class="attachment-item">
      <div class="attachment-main">
        <span class="attachment-icon">file</span>
        <div>
          <div class="attachment-name">${escHtml(attachment.name || "Allegato")}</div>
          ${meta ? `<div class="attachment-meta">${escHtml(meta)}</div>` : ""}
        </div>
      </div>
      ${
        attachment.id
          ? `<button class="attachment-link" type="button" data-open-attachment-id="${escAttr(attachment.id)}">Apri allegato</button>`
          : `<span class="attachment-unavailable">Allegato presente, ma ID non disponibile.</span>`
      }
    </div>`;
}

async function openAttachment(button) {
  const attachmentId = button.dataset.openAttachmentId;
  const originalText = button.textContent;

  button.disabled = true;
  button.textContent = "Apro...";

  try {
    const response = await fetch(`/api/attachment?attachmentId=${encodeURIComponent(attachmentId)}`);
    const data = await response.json();

    if (!response.ok || !data.url) {
      throw new Error(data.message || data.error || "URL allegato non disponibile.");
    }

    window.open(data.url, "_blank", "noopener,noreferrer");
  } catch (error) {
    showToast(error.message || "Impossibile aprire l'allegato");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function fileExtension(name) {
  const match = String(name || "").match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toUpperCase() : "";
}

function renderLoading() {
  elements.mainArea.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">...</div>
      <h3>Caricamento da Smartsheet</h3>
      <p>Lettura del foglio Knowledge Hub nel workspace configurato.</p>
    </div>`;
}

function renderEmpty() {
  elements.mainArea.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">0</div>
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
    terms.some((word) => searchableValues(item).some((value) => String(value || "").toLowerCase().includes(word))),
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
