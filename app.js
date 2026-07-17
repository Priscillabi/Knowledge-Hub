let db = [];
let activeTipo = "all";
let activeTool = "all";
let activeFacets = {};
let searchTerm = "";
let technicalFiltersUnlocked = false;

const TOOL_COLORS = {
  Smartsheet: "#0F6E56",
  "Power BI": "#2A327C",
  Excel: "#1A5C38",
  "Power Query": "#5B4FD4",
  "Virtus Flow": "#854F0B",
  "Power Automate": "#F13557",
};

const TIPO_COLORS = {
  "Best Practice": "#0F6E56",
  "Issue - Workaround": "#F13557",
  Template: "#2A327C",
};

const FACET_CONFIG = [
  { sectionName: "Smartsheet", columns: ["Smartsheet - tecnica"] },
  { sectionName: "Power BI", columns: ["Power BI - tecnica"] },
  { sectionName: "Power Query", columns: ["Power Query - tecnica"] },
  { sectionName: "Excel", columns: ["Excel - tecnica"] },
  { sectionName: "Virtus Flow", columns: ["Virtus Flow - tecnica"] },
  { sectionName: "Power Automate", columns: ["Power Automate - tecnica"] },
];

const TOOL_COLUMN_CONFIG = {
  Smartsheet: {
    markerColumn: "Smartsheet",
    technicalColumn: "Smartsheet - tecnica",
    altroColumn: "Specifica Altro [Smartsheet]",
  },
  "Power BI": {
    markerColumn: "Power BI",
    technicalColumn: "Power BI - tecnica",
    altroColumn: "Specifica Altro [Power BI]",
  },
  "Power Query": {
    markerColumn: "Power Query",
    technicalColumn: "Power Query - tecnica",
    altroColumn: "Specifica Altro [Power Query]",
  },
  Excel: {
    markerColumn: "Excel",
    technicalColumn: "Excel - tecnica",
    altroColumn: "Specifica Altro [Excel]",
  },
  "Virtus Flow": {
    markerColumn: "Virtus Flow",
    technicalColumn: "Virtus Flow - tecnica",
    altroColumn: "Specifica Altro [Virtus Flow]",
  },
  "Power Automate": {
    markerColumn: "Power Automate",
    technicalColumn: "Power Automate - tecnica",
    altroColumn: "Specifica Altro [Power Automate]",
  },
};

/*
  Censimento informazione form map
  - SPEC §2: CENSIMENTO_INFO_TYPES + renderInfoTypeField
  - SPEC §3: renderWorkaroundField + reset on master change
  - SPEC §4: CENSIMENTO_TOOLS + renderToolField
  - SPEC §5.x / §10: FUNCTIONALITY_CONFIG + hasCodeTrigger
  - SPEC §6: renderDetailSection
  - SPEC §7: pulsante Invia in index.html
*/
const CENSIMENTO_INFO_TYPES = [
  {
    value: "Issue - Workaround",
    description: "per l'inserimento di una criticità alla quale potrebbe essere associata una risoluzione oppure no",
  },
  { value: "Best Practice", description: "per buone pratiche operative" },
  { value: "Elemento tecnico", description: "(es. Formule, Query, ...)" },
  { value: "Template", description: "per strutture riutilizzabili" },
  { value: "Procedure Operative Standard (SOP)", description: "" },
];

const CENSIMENTO_TOOLS = [
  "Word",
  "Power Point",
  "Excel",
  "Smartsheet",
  "Power BI (linguaggio: DAX)",
  "Power Query (linguaggio: M)",
  "Virtus Flow",
  "Power Automate",
  "Synthesia",
];

const TOOL_VALUE_ALIASES = {
  "Power BI (linguaggio: DAX)": "Power BI",
  "Power Query (linguaggio: M)": "Power Query",
};

const FUNCTIONALITY_CONFIG = {
  Excel: {
    note: "Nota: selezionando Formula, Macro, Funzionalità o Altro viene sbloccato il campo dedicato all'inserimento di un eventuale codice. Se non utilizzato alcun codice, il box può essere lasciato vuoto.",
    options: [
      { value: "Formula", triggersCode: true },
      { value: "Macro", triggersCode: true },
      { value: "Funzionalità", triggersCode: true },
      { value: "Altro", triggersCode: true },
    ],
  },
  Smartsheet: {
    note: "Nota: selezionando Formula viene sbloccato il campo dedicato all'inserimento di un eventuale codice. Se non utilizzato alcun codice, il box può essere lasciato vuoto.",
    options: [
      { value: "Formula", triggersCode: true },
      { value: "Data Shuttle", triggersCode: false },
      { value: "Data Mesh", triggersCode: false },
      { value: "Dynamic View", triggersCode: false },
      { value: "Altro", triggersCode: true },
    ],
  },
  "Power BI": {
    note: "Nota: selezionando Misura, Colonna Calcolata o Altro viene sbloccato il campo dedicato all'inserimento di un eventuale codice. Se non utilizzato alcun codice, il box può essere lasciato vuoto.",
    options: [
      { value: "Misura", triggersCode: true },
      { value: "Grafici", triggersCode: false },
      { value: "Colonna Calcolata", triggersCode: true },
      { value: "Segnalibro", triggersCode: false },
      { value: "Altro", triggersCode: true },
    ],
  },
  "Power Query": {
    note: "Nota: selezionando Query, Colonna Personalizzata, Colonna Condizionale o Altro viene sbloccato il campo dedicato all'inserimento di un eventuale codice. Se non utilizzato alcun codice, il box può essere lasciato vuoto.",
    options: [
      { value: "Query", triggersCode: true },
      { value: "Colonna Personalizzata", triggersCode: true },
      { value: "Colonna Condizionale", triggersCode: true },
      { value: "Altro", triggersCode: true },
    ],
  },
  "Virtus Flow": {
    note: "Nota: specificando Altro nel campo omonimo, fa sì che venga sbloccato il campo dedicato all'inserimento di un eventuale codice. Se non utilizzato alcun codice, il box può essere lasciato vuoto.",
    options: [
      {
        value: "Data Object",
        description:
          "da selezionare se l'informazione riguarda la struttura dei dati, gli oggetti informativi, i campi, le relazioni o la gestione di database personalizzati utilizzati nel processo",
        triggersCode: false,
      },
      {
        value: "Workflow",
        description:
          "da selezionare se l'informazione riguarda uno step approvativo, una regola di instradamento o una logica esecutiva del processo",
        triggersCode: false,
      },
      {
        value: "Macro Workflow",
        description:
          "da selezionare se l'informazione riguarda la vista end-to-end di un processo, il collegamento tra più workflow o il disegno complessivo di un processo articolato in più fasi",
        triggersCode: false,
      },
      {
        value: "Document & Template",
        description:
          "da selezionare se l'informazione riguarda template riutilizzabili, generazione o gestione documentale, modelli standardizzati oppure configurazioni documentali collegate ai processi",
        triggersCode: false,
      },
      {
        value: "Ticketing",
        description:
          "da selezionare se l'informazione riguarda la gestione di ticket, richieste, segnalazioni, casi di assistenza o attività tracciate tramite logiche di ticketing",
        triggersCode: false,
      },
      {
        value: "Resource (Internal or External)",
        description:
          "da selezionare se l'informazione riguarda utenti, ruoli, gruppi, assegnazioni o risorse interne/esterne coinvolte nel processo",
        triggersCode: false,
      },
      {
        value: "Reporting",
        description:
          "da selezionare se l'informazione riguarda report, dashboard, indicatori, monitoraggio delle performance o analisi dei dati del processo",
        triggersCode: false,
      },
      { value: "Altro", triggersCode: true },
    ],
  },
  "Power Automate": {
    note: "Nota: specificando Altro nel campo omonimo, fa sì che venga sbloccato il campo dedicato all'inserimento di un eventuale codice. Se non utilizzato alcun codice, il box può essere lasciato vuoto.",
    options: [
      {
        value: "Flow",
        description:
          "informazione sul flusso nel suo complesso. In Descrizione specificare la tipologia (Automated Flow, Instant Flow, Scheduled Flow, Desktop Flow)",
        triggersCode: false,
      },
      {
        value: "Trigger",
        description:
          "evento/condizione che avvia il flusso. In Descrizione specificare quale trigger e in quale contesto si attiva",
        triggersCode: false,
      },
      {
        value: "Azioni",
        description:
          "una o più azioni eseguite nel flusso. In Descrizione indicare cosa fa il flusso, quali passaggi esegue, quale output produce",
        triggersCode: false,
      },
      {
        value: "Logica",
        description:
          "condizioni, rami decisionali, cicli o altre logiche di controllo. In Descrizione riportare il comportamento logico implementato e i criteri decisionali",
        triggersCode: false,
      },
      {
        value: "Variabili",
        description:
          "variabili, operazioni sui dati, gestione dei valori. In Descrizione specificare quali variabili/strutture dati e con quale finalità",
        triggersCode: false,
      },
      {
        value: "Connettori",
        description:
          "servizi collegati al flusso (es. Outlook, Teams, SharePoint, Excel, Smartsheet, altri). In Descrizione indicare i connettori utilizzati",
        triggersCode: false,
      },
      {
        value: "API",
        description:
          "integrazioni applicative, endpoint esterni, connessioni avanzate. In Descrizione specificare il tipo di integrazione e lo scopo",
        triggersCode: false,
      },
      {
        value: "Approvazioni",
        description:
          "flusso approvativo/validazione gestita tramite Power Automate. In Descrizione indicare il processo approvativo configurato e i soggetti coinvolti",
        triggersCode: false,
      },
      {
        value: "Gestione errori",
        description:
          "gestione di errori, eccezioni, retry policy, terminazione controllata, notifiche di fallimento. In Descrizione specificare come è configurata la logica di gestione errori",
        triggersCode: false,
      },
      {
        value: "Monitoring",
        description: "monitoraggio/diagnostica del flusso. In Descrizione indicare come è impostato il monitoraggio",
        triggersCode: false,
      },
      { value: "Altro", triggersCode: true },
    ],
  },
};

let entryState = {
  infoType: "",
  workaround: "",
  tools: [],
  functionalities: {},
  otherDetails: {},
};
let entryAttachmentFiles = [];
let pendingEntryScrollPositions = {};

const IMAGE_PREVIEW_EXTENSIONS = new Set(["JPG", "JPEG", "PNG", "GIF", "WEBP"]);
const MAX_DIRECT_ATTACHMENT_BYTES = 30 * 1024 * 1024;

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
  newEntryButton: document.querySelector("#new-entry-button"),
  entryModal: document.querySelector("#entryModal"),
  entryFormBody: document.querySelector("#entryFormBody"),
  entryModalClose: document.querySelector("#entryModalClose"),
  entryForm: document.querySelector("#entryForm"),
  entryCancel: document.querySelector("#entryCancel"),
  entrySubmit: document.querySelector("#entrySubmit"),
  entryFormFeedback: document.querySelector("#entryFormFeedback"),
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
    const data = await parseApiResponse(response);

    if (!response.ok) {
      throw new Error(data.message || data.error || `Errore ${response.status}`);
    }

    db = (data.sheet?.entries || []).map(normalizeEntry);
    activeTipo = "all";
    activeTool = "all";
    activeFacets = {};
    technicalFiltersUnlocked = false;
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
    technicalFiltersUnlocked = false;
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
      technicalFiltersUnlocked = true;
      pruneHiddenFacetSelections();
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
  if (!technicalFiltersUnlocked) return "";

  return visibleFacetConfigs()
    .map((config) => buildFacetFilters(config.sectionName, config.columns))
    .filter(Boolean)
    .join("");
}

function visibleFacetConfigs() {
  if (activeTool === "all") return FACET_CONFIG;

  return FACET_CONFIG.filter((config) => toolMatchesFacetSection(activeTool, config.sectionName));
}

function toolMatchesFacetSection(tool, sectionName) {
  const normalizedTool = String(tool || "").toLowerCase();
  const normalizedSection = String(sectionName || "").toLowerCase();
  return normalizedTool.includes(normalizedSection) || normalizedSection.includes(normalizedTool);
}

function pruneHiddenFacetSelections() {
  if (activeTool === "all") return;

  const visibleSections = new Set(visibleFacetConfigs().map((config) => config.sectionName));
  activeFacets = Object.fromEntries(Object.entries(activeFacets).filter(([sectionName]) => visibleSections.has(sectionName)));
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
  if (kind === "tool") {
    activeTool = "all";
    activeFacets = {};
    technicalFiltersUnlocked = false;
  }
  if (kind === "facet") toggleFacetSelection(sectionName, value);

  buildFilters();
  renderActiveFilters();
  render();
}

function clearAllFilters() {
  activeTipo = "all";
  activeTool = "all";
  activeFacets = {};
  technicalFiltersUnlocked = false;
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
  const countByTipo = (tipo) => db.filter((item) => itemHasSplitValue(item, "tipo", tipo)).length;

  elements.statsBar.innerHTML = `
    <section class="stats-total" aria-label="Totale informazioni inserite">
      <div class="stat-main">
        <span class="stat-label">Totale informazioni inserite</span>
        <strong>${db.length}</strong>
      </div>
      <div class="stat-breakdown">
        <span class="stat-breakdown-label">di cui per tipologia</span>
        <div class="stat-breakdown-items">
          <div class="stat-chip"><strong>${countByTipo("Best Practice")}</strong><span>Best Practice</span></div>
          <div class="stat-chip"><strong>${countByTipo("Elemento tecnico")}</strong><span>Elemento tecnico</span></div>
          <div class="stat-chip"><strong>${countByTipo("Issue - Workaround")}</strong><span>Issue - Workaround</span></div>
        </div>
      </div>
    </section>
    <section class="stats-tools" aria-label="Totale strumenti">
      <span class="stat-label">Totale strumenti</span>
      <strong>${tools}</strong>
    </section>`;
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

  document.querySelectorAll("[data-preview-attachment-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      previewAttachment(button);
    });
  });

  document.querySelectorAll("[data-download-attachment-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      downloadAttachment(button);
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
  const previewMode = previewModeForAttachment(attachment);
  const canPreview = Boolean(attachment.id && previewMode);
  const canDownload = Boolean(attachment.id);
  const actions = [
    canPreview
      ? `<button class="attachment-link" type="button" data-preview-attachment-id="${escAttr(attachment.id)}">Anteprima</button>`
      : "",
    canDownload ? `<button class="attachment-link" type="button" data-download-attachment-id="${escAttr(attachment.id)}">Scarica</button>` : "",
  ].filter(Boolean);

  return `
    <div class="attachment-item">
      <div class="attachment-main">
        <span class="attachment-icon">file</span>
        <div>
          ${
            canPreview
              ? `<button class="attachment-name attachment-name-button" type="button" data-preview-attachment-id="${escAttr(attachment.id)}">${escHtml(attachment.name || "Allegato")}</button>`
              : `<div class="attachment-name">${escHtml(attachment.name || "Allegato")}</div>`
          }
          ${meta ? `<div class="attachment-meta">${escHtml(meta)}</div>` : ""}
        </div>
      </div>
      ${
        actions.length
          ? `<div class="attachment-actions">${actions.join("")}</div>`
          : `<span class="attachment-unavailable">Azioni non disponibili per questo allegato.</span>`
      }
    </div>`;
}

function fileExtension(name) {
  const match = String(name || "").match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toUpperCase() : "";
}

function previewModeForAttachment(attachment) {
  if (!attachment?.id) return "";
  const extension = fileExtension(attachment.name);
  if (IMAGE_PREVIEW_EXTENSIONS.has(extension)) return "image";
  return "";
}

function previewAttachment(button) {
  const attachmentId = button.dataset.previewAttachmentId;
  if (!attachmentId) return;
  const previewUrl = `/api/attachment?attachmentId=${encodeURIComponent(attachmentId)}&mode=preview`;
  window.open(previewUrl, "_blank", "noopener,noreferrer");
}

async function downloadAttachment(button) {
  const attachmentId = button.dataset.downloadAttachmentId;
  const originalText = button.textContent;

  button.disabled = true;
  button.textContent = "Scarico...";

  try {
    const link = document.createElement("a");
    link.href = `/api/attachment?attachmentId=${encodeURIComponent(attachmentId)}&mode=download`;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    showToast(error.message || "Impossibile scaricare l'allegato");
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

function openEntryModal() {
  resetEntryState();
  elements.entryFormFeedback.textContent = "";
  elements.entryFormFeedback.className = "form-feedback";
  renderEntryForm();
  elements.entryModal.classList.add("show");
  elements.entryModal.setAttribute("aria-hidden", "false");
  elements.entryForm.querySelector("[name='title']").focus();
}

function closeEntryModal() {
  elements.entryModal.classList.remove("show");
  elements.entryModal.setAttribute("aria-hidden", "true");
}

function requiredMark() {
  return '<span class="required-mark">*</span>';
}

function resetEntryState() {
  entryState = {
    infoType: "",
    workaround: "",
    tools: [],
    functionalities: {},
    otherDetails: {},
  };
  entryAttachmentFiles = [];
}

function renderEntryForm(preserveValues = {}) {
  const title = preserveValues.title || "";
  const desc = preserveValues.desc || "";
  const query = preserveValues.query || "";

  elements.entryFormBody.innerHTML = `
    <section class="form-section">
      <div class="form-intro">
        <p>
          In questa sezione vengono raccolte le <strong>informazioni generali</strong> necessarie a classificare il contenuto che si intende inserire.
        </p>
        <p>
          Selezionare la <strong>tipologia di informazione</strong>, lo <strong>strumento</strong> e le eventuali <strong>funzionalità di riferimento</strong>, al fine di consentire una corretta organizzazione e una più efficace ricerca all'interno della libreria di know-how.
        </p>
        <p>
          Le scelte effettuate in questa sezione determinano la struttura dei campi successivi e abilitano la compilazione delle informazioni di dettaglio.
        </p>
      </div>
      <label class="field span-2">
        <span>Titolo Iniziativa ${requiredMark()}</span>
        <input type="text" name="title" autocomplete="off" required value="${escAttr(title)}" placeholder="Inserire un titolo sintetico dell'iniziativa o dell'informazione" />
      </label>
      ${renderInfoTypeField()}
      ${entryState.infoType === "Issue - Workaround" ? renderWorkaroundField() : ""}
      ${entryState.infoType ? renderToolField() : ""}
      ${renderFunctionalitySections()}
      ${entryState.tools.length ? renderDetailSection(desc, query) : ""}
    </section>`;

  bindEntryFormEvents();
  restoreEntryScrollPositions();
}

function renderInfoTypeField() {
  return `
    <label class="field span-2">
      <span>Che tipo di informazione stai inserendo? ${requiredMark()}</span>
      <div class="field-help">
        <p>Selezionare la tipologia che meglio descrive il contenuto che si sta inserendo, scegliendo un'alternativa tra:</p>
        <ul>
          ${CENSIMENTO_INFO_TYPES.map((item) => `<li><strong>${escHtml(item.value)}</strong>${item.description ? ` ${escHtml(item.description)}` : ""}</li>`).join("")}
        </ul>
        <p>
          In caso di SOP, selezionare lo strumento a cui la procedura si riferisce.<br>
          <em>(es. in caso di una SOP di una soluzione Smartsheet, inserire in Strumento: Smartsheet)</em>
        </p>
      </div>
      <select name="tipo" required>
        <option value="">Seleziona...</option>
        ${CENSIMENTO_INFO_TYPES.map((item) => `<option value="${escAttr(item.value)}" ${entryState.infoType === item.value ? "selected" : ""}>${escHtml(item.value)}</option>`).join("")}
      </select>
    </label>`;
}

function renderWorkaroundField() {
  return `
    <label class="field span-2">
      <span>Hai trovato un workaround? ${requiredMark()}</span>
      <div class="field-help">
        <p>Selezionare <strong>'Sì'</strong> se è stata individuata una possibile soluzione alla criticità (Issue) riscontrata.</p>
        <p>Selezionare <strong>'No'</strong> qualora la criticità non abbia, al momento, una risoluzione definita; in questo caso, l'informazione viene registrata come <strong>limite noto</strong>.</p>
      </div>
      <select name="workaround" required>
        <option value="">Seleziona...</option>
        <option value="Sì" ${entryState.workaround === "Sì" ? "selected" : ""}>Sì</option>
        <option value="No" ${entryState.workaround === "No" ? "selected" : ""}>No</option>
      </select>
    </label>`;
}

function renderToolField() {
  const example =
    entryState.infoType === "Elemento tecnico"
      ? "es. Voglio inserire una formula di Smartsheet, allora selezionare in Strumento: Smartsheet"
      : "es. Voglio inserire un Template di un manuale realizzato in Word, allora selezionare in Strumento: Word";

  return `
    <div class="field span-2">
      <span>Strumento ${requiredMark()}</span>
      <div class="field-help">
        <p>Selezionare dall'elenco lo strumento a cui l'informazione che si vuole inserire fa riferimento.</p>
        <p><em>${escHtml(example)}</em></p>
      </div>
      <div class="checkbox-list tool-list" data-scroll-key="tools" role="group" aria-label="Strumento">
        <label class="checkbox-row select-all-row">
          <input type="checkbox" data-entry-select-all-tools ${entryState.tools.length === CENSIMENTO_TOOLS.length ? "checked" : ""}>
          <span>Seleziona tutto</span>
        </label>
        <div class="tool-options-grid">
        ${CENSIMENTO_TOOLS.map((tool) => `
          <label class="checkbox-row">
            <input type="checkbox" name="tools" value="${escAttr(tool)}" ${entryState.tools.includes(tool) ? "checked" : ""}>
            <span>${escHtml(tool)}</span>
          </label>`).join("")}
        ${CENSIMENTO_TOOLS.length % 2 ? '<div class="tool-grid-placeholder" aria-hidden="true"></div>' : ""}
        </div>
      </div>
    </div>`;
}

function renderFunctionalitySections() {
  return CENSIMENTO_TOOLS.filter((tool) => entryState.tools.includes(tool))
    .map((tool) => normalizedToolName(tool))
    .filter((tool) => FUNCTIONALITY_CONFIG[tool])
    .map((tool) => renderFunctionalitySection(tool))
    .join("");
}

function renderFunctionalitySection(tool) {
  const config = FUNCTIONALITY_CONFIG[tool];
  const selected = entryState.functionalities[tool] || [];
  const showOther = selected.includes("Altro");

  return `
    <section class="form-subsection" data-functionality-section="${escAttr(tool)}">
      <h3>${escHtml(tool)}</h3>
      <div class="field-help">
        <p>Selezionare dall'elenco una o più funzionalità di ${escHtml(tool)} a cui l'informazione che si vuole inserire fa riferimento.</p>
        <p><strong>${escHtml(config.note)}</strong></p>
      </div>
      <div class="field">
        <span>Funzionalità di ${escHtml(tool)} ${requiredMark()}</span>
        <div class="checkbox-list" data-scroll-key="functionality-${escAttr(tool)}" role="group" aria-label="Funzionalità di ${escAttr(tool)}">
          ${config.options.map((option) => `
            <label class="checkbox-row">
              <input type="checkbox" name="functionality-${escAttr(tool)}" value="${escAttr(option.value)}" ${selected.includes(option.value) ? "checked" : ""}>
              <span><strong>${escHtml(option.value)}</strong>${option.description ? `: ${escHtml(option.description)}` : ""}</span>
            </label>`).join("")}
        </div>
      </div>
      ${showOther ? `
        <label class="field">
          <span>Specifica Altro ${requiredMark()}</span>
          <div class="field-help">
            <p>Specificare la funzionalità dello strumento a cui l'informazione che si vuole inserire fa riferimento.</p>
          </div>
          <input type="text" name="other-${escAttr(tool)}" value="${escAttr(entryState.otherDetails[tool] || "")}" />
        </label>` : ""}
    </section>`;
}

function renderDetailSection(desc, query) {
  const showQuery = hasCodeTrigger();

  return `
    <section class="form-subsection detail-section">
      <h3>Dettaglio informazione</h3>
      <div class="field-help">
        <p>
          Nella presente sezione è richiesto di descrivere nel <strong>dettaglio il contenuto dell'informazione</strong>, fornendo tutti gli elementi utili alla sua comprensione e al suo riutilizzo.
        </p>
        <p>
          Inserire in modo chiaro e strutturato il contesto, il <strong>problema o l'obiettivo</strong> affrontato, la <strong>soluzione</strong> adottata e gli eventuali <strong>risultati o considerazioni</strong> rilevanti.
        </p>
        <p>
          Una descrizione completa consente di valorizzare il contributo inserito e di renderlo effettivamente utile per i progetti futuri e per l'intero team.
        </p>
      </div>
      <label class="field">
        <span>Descrizione ${requiredMark()}</span>
        <div class="field-help">
          <p>Inserire una descrizione che risponda alle seguenti domande:</p>
          <ul>
            <li>Qual è il contesto (es. progetto, processo, cliente, etc.) e l'obiettivo dell'informazione?</li>
            <li>Quale è stato o quale è il problema riscontrato?</li>
            <li>Quale è stata o quale è la soluzione adottata?</li>
          </ul>
          <p><strong>NOTA</strong>: Le domande proposte sono una guida orientativa per facilitare l'elaborazione del campo descrittivo; pertanto, il campo può essere utilizzato anche per inserire eventuali note o commenti rilevanti.</p>
        </div>
        <textarea name="desc" rows="6" placeholder="Una descrizione completa rende questa informazione molto più utile per il team...">${escHtml(desc)}</textarea>
      </label>
      ${showQuery ? `
        <label class="field">
          <span>Inserire la formula o la query all'interno del box ${requiredMark()}</span>
          <div class="field-help">
            <p>Se la formula/query supera il limite dei caratteri consentiti (max 4.000), si consiglia di caricarla come allegato nella sezione dedicata.</p>
          </div>
          <textarea name="query" rows="7" placeholder="Inserire qui formula, query, codice o logica tecnica da condividere.">${escHtml(query)}</textarea>
        </label>` : ""}
      <label class="field">
        <span>File Upload</span>
        <div class="field-help">
          <p>Allegare eventuale documentazione a supporto.</p>
          <p>È possibile caricare file con una dimensione massima di 30 MB ciascuno. Per file di dimensioni superiori, si consiglia di comprimerli in formato .zip prima del caricamento.</p>
        </div>
        <div class="file-upload-control">
          <input class="file-upload-input" id="entryAttachments" type="file" name="attachments" multiple />
          <label class="file-upload-button" for="entryAttachments">Aggiungi file</label>
          <span class="file-upload-name" id="entryAttachmentNames">Nessun file selezionato</span>
        </div>
        <div class="selected-attachments-list" id="entrySelectedAttachments">
          ${renderSelectedEntryAttachments()}
        </div>
      </label>
    </section>`;
}

function bindEntryFormEvents() {
  const typeSelect = elements.entryForm.querySelector("[name='tipo']");
  const workaroundSelect = elements.entryForm.querySelector("[name='workaround']");
  const selectAllTools = elements.entryForm.querySelector("[data-entry-select-all-tools]");

  typeSelect?.addEventListener("change", () => {
    captureEntryScrollPositions();
    entryState.infoType = typeSelect.value;
    entryState.workaround = "";
    entryState.tools = [];
    entryState.functionalities = {};
    entryState.otherDetails = {};
    renderEntryForm(preserveEntryValues());
  });

  workaroundSelect?.addEventListener("change", () => {
    entryState.workaround = workaroundSelect.value;
  });

  selectAllTools?.addEventListener("change", () => {
    captureEntryScrollPositions();
    entryState.tools = selectAllTools.checked ? [...CENSIMENTO_TOOLS] : [];
    entryState.functionalities = pruneFunctionalityState(entryState.tools, entryState.functionalities);
    entryState.otherDetails = pruneFunctionalityState(entryState.tools, entryState.otherDetails);
    renderEntryForm(preserveEntryValues());
  });

  elements.entryForm.querySelectorAll("[name='tools']").forEach((input) => {
    input.addEventListener("change", () => {
      captureEntryScrollPositions();
      entryState.tools = [...elements.entryForm.querySelectorAll("[name='tools']:checked")].map((item) => item.value);
      entryState.functionalities = pruneFunctionalityState(entryState.tools, entryState.functionalities);
      entryState.otherDetails = pruneFunctionalityState(entryState.tools, entryState.otherDetails);
      renderEntryForm(preserveEntryValues());
    });
  });

  Object.keys(FUNCTIONALITY_CONFIG).forEach((tool) => {
    elements.entryForm.querySelectorAll(`[name='functionality-${cssEscape(tool)}']`).forEach((input) => {
      input.addEventListener("change", () => {
        captureEntryScrollPositions();
        entryState.functionalities[tool] = [...elements.entryForm.querySelectorAll(`[name='functionality-${cssEscape(tool)}']:checked`)].map((item) => item.value);
        renderEntryForm(preserveEntryValues());
      });
    });

    const otherInput = elements.entryForm.querySelector(`[name='other-${cssEscape(tool)}']`);
    otherInput?.addEventListener("input", () => {
      entryState.otherDetails[tool] = otherInput.value;
    });
  });

  const attachmentInput = elements.entryForm.querySelector("[name='attachments']");
  attachmentInput?.addEventListener("change", updateAttachmentNames);
  elements.entryForm.querySelectorAll("[data-remove-entry-attachment]").forEach((button) => {
    button.addEventListener("click", () => removeEntryAttachment(Number(button.dataset.removeEntryAttachment)));
  });
}

function captureEntryScrollPositions() {
  pendingEntryScrollPositions = {};
  elements.entryForm.querySelectorAll("[data-scroll-key]").forEach((node) => {
    pendingEntryScrollPositions[node.dataset.scrollKey] = node.scrollTop;
  });
}

function restoreEntryScrollPositions() {
  window.requestAnimationFrame(() => {
    elements.entryForm.querySelectorAll("[data-scroll-key]").forEach((node) => {
      const key = node.dataset.scrollKey;
      if (Object.prototype.hasOwnProperty.call(pendingEntryScrollPositions, key)) {
        node.scrollTop = pendingEntryScrollPositions[key];
      }
    });
  });
}

function preserveEntryValues() {
  return {
    title: elements.entryForm.querySelector("[name='title']")?.value || "",
    desc: elements.entryForm.querySelector("[name='desc']")?.value || "",
    query: elements.entryForm.querySelector("[name='query']")?.value || "",
  };
}

function updateAttachmentNames() {
  const input = elements.entryForm.querySelector("[name='attachments']");
  if (!input) return;

  [...input.files].forEach((file) => {
    const duplicate = entryAttachmentFiles.some((currentFile) => currentFile.name === file.name && currentFile.size === file.size);
    if (!duplicate) entryAttachmentFiles.push(file);
  });

  input.value = "";
  refreshSelectedEntryAttachments();
}

function removeEntryAttachment(index) {
  if (!Number.isInteger(index) || index < 0 || index >= entryAttachmentFiles.length) return;
  entryAttachmentFiles.splice(index, 1);
  refreshSelectedEntryAttachments();
}

function refreshSelectedEntryAttachments() {
  const label = elements.entryForm.querySelector("#entryAttachmentNames");
  const list = elements.entryForm.querySelector("#entrySelectedAttachments");
  if (label) {
    label.textContent = entryAttachmentFiles.length
      ? `${entryAttachmentFiles.length} file selezionati`
      : "Nessun file selezionato";
  }
  if (list) {
    list.innerHTML = renderSelectedEntryAttachments();
    list.querySelectorAll("[data-remove-entry-attachment]").forEach((button) => {
      button.addEventListener("click", () => removeEntryAttachment(Number(button.dataset.removeEntryAttachment)));
    });
  }
}

function renderSelectedEntryAttachments() {
  if (!entryAttachmentFiles.length) return "";

  return entryAttachmentFiles
    .map(
      (file, index) => `
        <div class="selected-attachment-item">
          <span class="selected-attachment-name">${escHtml(file.name)}</span>
          <span class="selected-attachment-size">${formatFileSize(file.size)}</span>
          <button class="selected-attachment-remove" type="button" data-remove-entry-attachment="${index}">Rimuovi</button>
        </div>`,
    )
    .join("");
}

function formatFileSize(bytes) {
  const value = Number(bytes) || 0;
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

function pruneFunctionalityState(selectedTools, valuesByTool) {
  const selectedNormalizedTools = new Set(selectedTools.map(normalizedToolName));
  return Object.fromEntries(Object.entries(valuesByTool).filter(([tool]) => selectedNormalizedTools.has(tool)));
}

function normalizedToolName(tool) {
  return TOOL_VALUE_ALIASES[tool] || tool;
}

function cssEscape(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function hasCodeTrigger() {
  return Object.entries(entryState.functionalities).some(([tool, selected]) => {
    const config = FUNCTIONALITY_CONFIG[tool];
    return selected.some((value) => config?.options.find((option) => option.value === value)?.triggersCode);
  });
}

function entryPayloadFromForm() {
  const preserved = preserveEntryValues();
  const desc = elements.entryForm.querySelector("[name='desc']")?.value.trim() || "";
  const query = elements.entryForm.querySelector("[name='query']")?.value.trim() || "";
  const normalizedTools = entryState.tools.map(normalizedToolName);

  return {
    title: preserved.title.trim(),
    tipo: entryState.infoType,
    workaround: entryState.workaround,
    strumenti: [...entryState.tools],
    normalizedStrumenti: normalizedTools,
    strumento: entryState.tools.join(", "),
    functionalities: entryState.functionalities,
    otherDetails: entryState.otherDetails,
    desc,
    query,
    attachmentNames: entryAttachmentFiles.map((file) => file.name),
    tag: buildEntryTags(entryState.tools),
    tagRicerca: entryState.infoType,
  };
}

function buildEntryTags(tools) {
  const functionalityTags = Object.values(entryState.functionalities).flat();
  return [...new Set([entryState.infoType, ...tools, ...functionalityTags].filter(Boolean))].join(", ");
}

function validateEntryPayload(payload) {
  const missing = [];
  if (!payload.title) missing.push("Titolo Iniziativa");
  if (!payload.tipo) missing.push("Che tipo di informazione stai inserendo?");
  if (payload.tipo === "Issue - Workaround" && !payload.workaround) missing.push("Hai trovato un workaround?");
  if (!payload.strumenti.length) missing.push("Strumento");
  if (payload.strumenti.length && !payload.desc) missing.push("Descrizione");

  payload.normalizedStrumenti.forEach((tool) => {
    if (!FUNCTIONALITY_CONFIG[tool]) return;

    const selected = Array.isArray(payload.functionalities[tool]) ? payload.functionalities[tool] : [];
    if (!selected.length) {
      missing.push(`Funzionalità di ${tool}`);
      return;
    }

    if (selected.includes("Altro") && !String(payload.otherDetails[tool] || "").trim()) {
      missing.push(`Specifica Altro (${tool})`);
    }
  });

  if (hasCodeTrigger() && !payload.query) missing.push("Inserire la formula o la query all'interno del box");

  if (missing.length) {
    return `Compila i campi obbligatori: ${missing.join(", ")}.`;
  }

  const oversizedFiles = entryAttachmentFiles.filter((file) => file.size > MAX_DIRECT_ATTACHMENT_BYTES);
  if (oversizedFiles.length) {
    return `Gli allegati possono pesare al massimo 30 MB ciascuno. Rimuovi o riduci: ${oversizedFiles.map((file) => file.name).join(", ")}.`;
  }

  return "";
}

function setEntryFormFeedback(message, state = "") {
  elements.entryFormFeedback.textContent = message;
  elements.entryFormFeedback.className = `form-feedback ${state}`.trim();
}

async function submitEntryForm(event) {
  event.preventDefault();

  const payload = entryPayloadFromForm();
  const validationMessage = validateEntryPayload(payload);

  if (validationMessage) {
    setEntryFormFeedback(validationMessage, "error");
    return;
  }

  elements.entrySubmit.disabled = true;
  elements.entrySubmit.textContent = "Invio...";
  setEntryFormFeedback("Invio della nuova informazione a Smartsheet...", "info");
  let keepSubmitDisabled = false;

  try {
    const response = await fetch("/api/smartsheet-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await parseApiResponse(response);

    if (!response.ok) {
      throw new Error(data.message || data.error || `Errore ${response.status}`);
    }

    const rowId = data.rowId || data.result?.result?.[0]?.id;
    const uploadResults = rowId && entryAttachmentFiles.length ? await uploadEntryAttachments(rowId) : [];
    const failedUploads = uploadResults.filter((item) => !item.ok);
    const successfulUploads = uploadResults.filter((item) => item.ok);

    if (failedUploads.length) {
      const failedNames = failedUploads.map((item) => item.fileName).join(", ");
      const message = `Informazione inserita. Allegati caricati: ${successfulUploads.length}/${uploadResults.length}. Non caricati: ${failedNames}.`;
      setEntryFormFeedback(message, "error");
      showToast("Informazione salvata, ma alcuni allegati non sono stati caricati");
      keepSubmitDisabled = true;
      elements.entrySubmit.textContent = "Inserimento salvato";
    } else {
      setEntryFormFeedback("Informazione inserita correttamente.", "success");
      showToast(entryAttachmentFiles.length ? "Nuova informazione e allegati salvati in Smartsheet" : "Nuova informazione salvata in Smartsheet");
    }

    await loadKnowledgeHub();
    if (!failedUploads.length) closeEntryModal();
  } catch (error) {
    setEntryFormFeedback(error.message || "Impossibile salvare la nuova informazione.", "error");
  } finally {
    if (!keepSubmitDisabled) {
      elements.entrySubmit.disabled = false;
      elements.entrySubmit.textContent = "Invia";
    }
  }
}

async function uploadEntryAttachments(rowId) {
  const results = [];

  for (const file of entryAttachmentFiles) {
    const formData = new FormData();
    formData.append("file", file, file.name);

    try {
      const response = await fetch(`/api/row-attachment?rowId=${encodeURIComponent(rowId)}`, {
        method: "POST",
        body: formData,
      });
      const data = await parseApiResponse(response);
      results.push({
        ok: response.ok,
        fileName: file.name,
        data,
        message: data.message || data.error || "",
      });
    } catch (error) {
      results.push({
        ok: false,
        fileName: file.name,
        message: error.message || "Errore caricamento allegato.",
      });
    }
  }

  return results;
}

async function parseApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return {
    error: "NON_JSON_RESPONSE",
    message: text || `Errore ${response.status}`,
  };
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
elements.newEntryButton.addEventListener("click", openEntryModal);
elements.entryModalClose.addEventListener("click", closeEntryModal);
elements.entryCancel.addEventListener("click", closeEntryModal);
elements.entryForm.addEventListener("submit", submitEntryForm);
elements.entryModal.addEventListener("click", (event) => {
  if (event.target === elements.entryModal) closeEntryModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && elements.entryModal.classList.contains("show")) closeEntryModal();
});
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
