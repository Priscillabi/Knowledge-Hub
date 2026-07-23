const DEFAULT_SHEET_ID = "5761322814754692";
const SMARTSHEET_API_BASE = "https://api.smartsheet.com/2.0";

const TOOL_COLUMN_CONFIG = {
  Smartsheet: {
    markerColumn: "Smartsheet",
    technicalColumn: "Smartsheet - tecnica",
    altroColumn: "Specifica Altro [Smartsheet]",
    listColumn: "TAG - List [Smartsheet]",
  },
  "Power BI": {
    markerColumn: "Power BI",
    technicalColumn: "Power BI - tecnica",
    altroColumn: "Specifica Altro [Power BI]",
    listColumn: "TAG - List [Power BI]",
  },
  "Power Query": {
    markerColumn: "Power Query",
    technicalColumn: "Power Query - tecnica",
    altroColumn: "Specifica Altro [Power Query]",
    listColumn: "TAG - List [Power Query]",
  },
  Excel: {
    markerColumn: "Excel",
    technicalColumn: "Excel - tecnica",
    altroColumn: "Specifica Altro [Excel]",
    listColumn: "TAG - List [Excel]",
  },
  "Virtus Flow": {
    markerColumn: "Virtus Flow",
    technicalColumn: "Virtus Flow - tecnica",
    altroColumn: "Specifica Altro [Virtus Flow]",
    listColumn: "TAG - List [Virtus Flow]",
  },
  "Power Automate": {
    markerColumn: "Power Automate",
    technicalColumn: "Power Automate - tecnica",
    altroColumn: "Specifica Altro [Power Automate]",
    listColumn: "TAG - List [Power Automate]",
  },
};

function getSheetId() {
  return process.env.SMARTSHEET_SHEET_ID || DEFAULT_SHEET_ID;
}

function getToken() {
  return process.env.SMARTSHEET_ACCESS_TOKEN || process.env.SMARTSHEET_TOKEN;
}

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function smartsheetHeaders() {
  const token = getToken();
  if (!token) {
    const error = new Error("Variabile d'ambiente SMARTSHEET_ACCESS_TOKEN non configurata.");
    error.statusCode = 500;
    throw error;
  }

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function smartsheetFetch(path, options = {}) {
  const response = await fetch(`${SMARTSHEET_API_BASE}${path}`, {
    ...options,
    headers: {
      ...smartsheetHeaders(),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    data = { raw: text };
  }

  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `Errore Smartsheet ${response.status}`);
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

function columnMap(sheet) {
  return new Map((sheet.columns || []).map((column) => [column.title, column]));
}

function cellDisplayValue(row, columnsById, title) {
  const column = [...columnsById.values()].find((item) => item.title === title);
  if (!column) return "";

  const cell = (row.cells || []).find((item) => item.columnId === column.id);
  return String(cell?.displayValue ?? cell?.value ?? "").trim();
}

function normalizeRow(row, columnsById) {
  const technical = {};

  Object.entries(TOOL_COLUMN_CONFIG).forEach(([tool, config]) => {
    technical[tool] = {};
    const value = cellDisplayValue(row, columnsById, config.technicalColumn);
    if (value) technical[tool][config.technicalColumn] = value;
  });

  return {
    id: String(row.id || ""),
    rowNumber: row.rowNumber,
    title: cellDisplayValue(row, columnsById, "Titolo Informazione") || cellDisplayValue(row, columnsById, "Titolo Iniziativa"),
    dataInserimento: cellDisplayValue(row, columnsById, "Data Inserimento"),
    tag: cellDisplayValue(row, columnsById, "TAG"),
    desc: cellDisplayValue(row, columnsById, "Descrizione"),
    query: cellDisplayValue(row, columnsById, "Inserire Formula o Query"),
    tipo: cellDisplayValue(row, columnsById, "Tipologia di contenuto"),
    strumento: cellDisplayValue(row, columnsById, "Strumento"),
    autore: cellDisplayValue(row, columnsById, "Nome e Cognome") || cellDisplayValue(row, columnsById, "Inserita da"),
    tagRicerca: cellDisplayValue(row, columnsById, "TAG - Ricerca"),
    workaround: cellDisplayValue(row, columnsById, "Workaround"),
    technical,
    attachments: row.attachments || [],
  };
}

function addCell(cells, columns, title, value) {
  if (value === undefined || value === null || value === "") return;
  const column = columns.get(title);
  if (!column) return;

  if (column.systemColumnType || column.autoNumberFormat || column.formula) {
    return;
  }

  let normalizedValue = value;

  if (column.type === "CHECKBOX") {
    normalizedValue = Boolean(value);
  }

  if (column.type === "DATE") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) normalizedValue = date.toISOString().slice(0, 10);
  }

  cells.push({ columnId: column.id, value: normalizedValue, strict: false });
}

function selectedToolConfig(tool) {
  return TOOL_COLUMN_CONFIG[tool] || null;
}

module.exports = {
  DEFAULT_SHEET_ID,
  TOOL_COLUMN_CONFIG,
  getSheetId,
  json,
  smartsheetFetch,
  columnMap,
  normalizeRow,
  addCell,
  selectedToolConfig,
};
