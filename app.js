let db = [];
let activeTipo = "all";
let activeTool = "all";
let activeFacets = {};
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
  { sectionName: "Smartsheet", columns: ["Smartsheet - tecnica"] },
  { sectionName: "Power BI", columns: ["Power BI - tecnica"] },
  { sectionName: "Power Query", columns: ["Power Query - tecnica"] },
  { sectionName: "Excel", columns: ["Excel - tecnica"] },
  { sectionName: "Virtus Flow", columns: ["Virtus Flow - tecnica"] },
  { sectionName: "Power Automate", columns: ["Power Automate - tecnica"] },
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
  fileBadge: document.querySelector("#fileBadge"),
  reloadButton: document.querySelector("#reload-button"),
  exportButton: document.querySelector("#export-button"),
  activeFilterBar: document.querySelector("#activeFilterBar"),
  introPanel: document.querySelector("#introPanel"),
  introClose: document.querySelector("#introClose"),
  introReopen: document.querySelector("#introReopen"),
};

function toolColor(tool) {
  for (const key in TOOL_COLORS) {
    if (tool && tool.includes(key)) return TOOL_COLORS[key];
  }
  return "#6B665E";
}

function tipoColor(tipo) {
  for (const key in TIPO_COLORS) {
    if (tipo && tipo.includes(key)) return TIPO_COLORS[key];
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

function parseDateValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const isoDate = Date.parse(raw);
  if (!Number.isNaN(isoDate)) return new Date(isoDate);

  const italianMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (italianMatch) {
    const [, day, month, year] = italianMatch;
    const fullYear = year.length === 2 ? `20${year}` : year;
    const date = new Date(Number(fullYear), Number(month) - 1, Number(day));
    if (!Number.isNaN(date.getTime())) return date;
  }

  return null;
}

function formatDate(value) {
  const date = parseDateValue(value);
  if (!date) return "Data non disponibile";

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function dateTimeValue(value) {
  const date = parseDateValue(value);
  return date ? date.getTime() : 0;
}

function resourceTitle(item) {
  const explicitTitle = String(item.title || "").trim();
  if (explicitTitle) return explicitTitle;

  const description = String(item.desc || item.workaround || item.query || "Risorsa knowledge base")
    .replace(/\s+/g, " ")
    .trim();

  return description.length > 180 ? `${description.slice(0, 177)}...` : description;
}

function normalizeEntry(entry) {
  return {
    id: entry.id,
    title: String(entry.title || "").trim(),
    displayTitle: resourceTitle(entry),
    dataInserimento: String(entry.dataInserimento || "").trim(),
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
    activeTipo = "all";
    activeTool = "all";
    activeFacets = {};
    searchTerm = "";
    elements.searchInput.value = "";
    elements.searchClear.style.display = "none";
    elements.fileBadge.style.display = "inline-flex";
    elements.sidebarFooter.textContent = `${data.workspace?.name || "Workspace"} - ${data.sheet?.name || "Knowledge Hub"}`;

    buildFilters();
    renderActiveFilters();
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
  db.forEach((item) => splitValues(item[key]).forEach((value) => values.add(value)));
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

function itemMatchesFacetSelection(item, sectionName, values) {
  if (!values.length) return true;

  const config = FACET_CONFIG.find((facet) => facet.sectionName === sectionName);
  const itemValues = itemFacetValues(item, sectionName, config?.columns || []);
  return values.every((value) => itemValues.has(value));
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
      renderActiveFilters();
      render();
    });
  });

  document.querySelectorAll("[data-tool]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTool = button.dataset.tool;
      buildFilters();
      renderActiveFilters();
      render();
    });
  });

  document.querySelectorAll("[data-facet-section]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleFacetSelection(button.dataset.facetSection, button.dataset.facetValue);
      buildFilters();
      renderActiveFilters();
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
  if (!values.length) return "";

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
          getSelectedFacetValues(sectionName).includes(value),
          sectionName,
        ),
      )
      .join("")}`;
}

function getSelectedFacetValues(sectionName) {
  return activeFacets[sectionName] || [];
}

function clearFilter(kind, sectionName = "", value = "") {
  if (kind === "tipo") activeTipo = "all";
  if (kind === "tool") activeTool = "all";
  if (kind === "facet") toggleFacetSelection(sectionName, value);

  buildFilters();
  renderActiveFilters();
  render();
}

function clearAllFilters() {
  activeTipo = "all";
  activeTool = "all";
  activeFacets = {};
  elements.searchInput.value = "";
  searchTerm = "";
  elements.searchClear.style.display = "none";
  buildFilters();
  renderActiveFilters();
  render();
}

function toggleFacetSelection(sectionName, value) {
  const selected = new Set(getSelectedFacetValues(sectionName));

  if (selected.has(value)) selected.delete(value);
  else selected.add(value);

  if (selected.size) {
    activeFacets = { ...activeFacets, [sectionName]: [...selected] };
  } else {
    const next = { ...activeFacets };
    delete next[sectionName];
    activeFacets = next;
  }
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

function getFiltered() {
  let items = [...db];

  if (activeTipo !== "all") {
    items = items.filter((item) => itemHasSplitValue(item, "tipo", activeTipo));
  }

  if (activeTool !== "all") {
    items = items.filter((item) => itemHasSplitValue(item, "strumento", activeTool));
  }

  Object.entries(activeFacets).forEach(([sectionName, values]) => {
    items = items.filter((item) => itemMatchesFacetSelection(item, sectionName, values));
  });

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    items = items.filter((item) =>
      searchableValues(item).some((value) => String(value || "").toLowerCase().includes(term)),
    );
  }

  return sortByMostRecent(items);
}

function sortByMostRecent(items) {
  return items.sort((a, b) => dateTimeValue(b.dataInserimento) - dateTimeValue(a.dataInserimento));
}

function searchableValues(item) {
  const technicalValues = Object.values(item.technical || {}).flatMap((section) => Object.values(section || {}));
  const attachmentNames = item.attachments.map((attachment) => attachment.name);

  return [
    item.displayTitle,
    item.desc,
    item.workaround,
    item.dataInserimento,
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

function activeFilterChips() {
  const chips = [];

  if (activeTipo !== "all") {
    chips.push({ label: `Tipologia: ${activeTipo}`, kind: "tipo" });
  }

  if (activeTool !== "all") {
    chips.push({ label: `Strumento: ${activeTool}`, kind: "tool" });
  }

  Object.entries(activeFacets).forEach(([sectionName, values]) => {
    values.forEach((value) => {
      chips.push({
        label: `${sectionName}: ${value}`,
        kind: "facet",
        sectionName,
        value,
      });
    });
  });

  if (searchTerm) {
    chips.push({ label: `Ricerca: ${searchTerm}`, kind: "search" });
  }

  return chips;
}

function renderActiveFilters() {
  const chips = activeFilterChips();

  if (!chips.length) {
    elements.activeFilterBar.innerHTML = "";
    elements.activeFilterBar.classList.remove("show");
    return;
  }

  elements.activeFilterBar.classList.add("show");
  elements.activeFilterBar.innerHTML = `
    <div class="active-filter-label">Filtri attivi</div>
    <div class="active-filter-chips">
      ${chips.map(activeFilterChipTemplate).join("")}
      <button class="active-filter-reset" type="button" data-clear-all>Reset</button>
    </div>`;

  elements.activeFilterBar.querySelectorAll("[data-clear-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const kind = button.dataset.kind;
      if (kind === "search") {
        elements.searchInput.value = "";
        onSearch("");
        return;
      }
      clearFilter(kind, button.dataset.sectionName || "", button.dataset.value || "");
    });
  });

  elements.activeFilterBar.querySelector("[data-clear-all]").addEventListener("click", clearAllFilters);
}

function activeFilterChipTemplate(chip) {
  return `
    <button class="active-filter-chip" type="button" data-clear-filter data-kind="${escAttr(chip.kind)}" data-section-name="${escAttr(chip.sectionName || "")}" data-value="${escAttr(chip.value || "")}">
      ${escHtml(chip.label)}
      <span>x</span>
    </button>`;
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
      <div class="sort-wrap">Ordinamento: <strong>Piu recente</strong></div>
    </div>
    <div class="cards" id="cards"></div>`;

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
    card.addEventListener("click", () => card.classList.toggle("open"));
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
  const toolLabel = item.strumento.length > 28 ? `${item.strumento.substring(0, 28)}...` : item.strumento;

  return `
    <article class="card" id="card-${escAttr(item.id)}" data-id="${escAttr(item.id)}" style="animation-delay:${Math.min(index, 12) * 0.03}s">
      <div class="card-head">
        <div class="card-title">${highlight(item.displayTitle, searchTerm)}</div>
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
        <span class="meta-item">Data Inserimento: ${escHtml(formatDate(item.dataInserimento))}</span>
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

  if (!chips.length) return "";

  return `
    <div class="detail-label with-gap">Funzionalita tecniche</div>
    <div class="technical-chips">
      ${chips.map((chip) => `<span class="technical-chip">${escHtml(chip.sectionName)}: ${escHtml(chip.value)}</span>`).join("")}
    </div>`;
}

function renderAttachments(attachments) {
  if (!attachments.length) return "";

  return `
    <div class="detail-label with-gap">Allegati</div>
    <div class="attachments-list">${attachments.map(attachmentTemplate).join("")}</div>
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

function fileExtension(name) {
  const match = String(name || "").match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toUpperCase() : "";
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

function onSearch(value) {
  searchTerm = value;
  elements.searchClear.style.display = value ? "flex" : "none";
  renderActiveFilters();
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

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2800);
}

function highlight(text, term) {
  if (!term || !text) return escHtml(text || "");

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

elements.searchInput.addEventListener("input", () => onSearch(elements.searchInput.value));
elements.searchClear.addEventListener("click", clearSearch);
elements.reloadButton.addEventListener("click", loadKnowledgeHub);
elements.exportButton.addEventListener("click", exportData);
elements.introClose.addEventListener("click", () => {
  elements.introPanel.classList.add("collapsed");
  elements.introReopen.classList.add("show");
});
elements.introReopen.addEventListener("click", () => {
  elements.introPanel.classList.remove("collapsed");
  elements.introReopen.classList.remove("show");
});
document.querySelectorAll("[data-filter-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    button.closest(".filter-section").classList.toggle("open");
  });
});

loadKnowledgeHub();
