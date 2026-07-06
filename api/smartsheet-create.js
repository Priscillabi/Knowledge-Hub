const {
  getSheetId,
  json,
  smartsheetFetch,
  columnMap,
  addCell,
  selectedToolConfig,
} = require("./_smartsheet");

function sanitizePayload(body = {}) {
  const payload = {};
  [
    "title",
    "tipo",
    "strumento",
    "desc",
    "workaround",
    "query",
    "technical",
    "specificaAltro",
    "tag",
    "autore",
    "tagRicerca",
  ].forEach((key) => {
    payload[key] = String(body[key] || "").trim();
  });
  return payload;
}

function validatePayload(payload) {
  const missing = [];
  if (!payload.title) missing.push("Titolo Iniziativa");
  if (!payload.tipo) missing.push("Tipologia di contenuto");
  if (!payload.strumento) missing.push("Strumento");
  if (!payload.desc) missing.push("Descrizione");

  if (missing.length) return `Compila i campi obbligatori: ${missing.join(", ")}.`;
  if (payload.autore && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.autore)) {
    return "Inserita da deve essere un indirizzo email valido.";
  }
  return "";
}

function requireTitleColumn(columns) {
  if (columns.has("Titolo Iniziativa")) {
    return { columnName: "Titolo Iniziativa", warning: "" };
  }

  if (columns.has("Titolo Informazione")) {
    return {
      columnName: "Titolo Informazione",
      warning: "La colonna 'Titolo Iniziativa' non esiste: il valore e stato scritto in 'Titolo Informazione'.",
    };
  }

  const error = new Error("Nel foglio non esiste la colonna 'Titolo Iniziativa' ne la colonna fallback 'Titolo Informazione'.");
  error.statusCode = 409;
  throw error;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Metodo non consentito." });
  }

  try {
    const payload = sanitizePayload(req.body);
    const validationMessage = validatePayload(payload);
    if (validationMessage) {
      return json(res, 400, { error: "VALIDATION_ERROR", message: validationMessage });
    }

    const sheet = await smartsheetFetch(`/sheets/${getSheetId()}`);
    const columns = columnMap(sheet);
    const { columnName: titleColumnName, warning } = requireTitleColumn(columns);
    const toolConfig = selectedToolConfig(payload.strumento);
    const cells = [];

    addCell(cells, columns, titleColumnName, payload.title);
    addCell(cells, columns, "Tipologia di contenuto", payload.tipo);
    addCell(cells, columns, "Strumento", payload.strumento);
    addCell(cells, columns, "Descrizione", payload.desc);
    addCell(cells, columns, "Workaround", payload.workaround);
    addCell(cells, columns, "Inserire Formula o Query", payload.query);
    addCell(cells, columns, "TAG", payload.tag);
    addCell(cells, columns, "TAG - Ricerca", payload.tagRicerca);
    addCell(cells, columns, "Inserita da", payload.autore);
    addCell(cells, columns, "Data Inserimento", new Date().toISOString());
    addCell(cells, columns, "TAG - Tipologia di contenuto", payload.tipo);
    addCell(cells, columns, "TAG - Strumento", payload.strumento);

    if (toolConfig) {
      addCell(cells, columns, toolConfig.markerColumn, "Si");
      addCell(cells, columns, toolConfig.technicalColumn, payload.technical);
      addCell(cells, columns, toolConfig.altroColumn, payload.specificaAltro);
      addCell(cells, columns, toolConfig.listColumn, payload.technical);
    }

    const result = await smartsheetFetch(`/sheets/${getSheetId()}/rows`, {
      method: "POST",
      body: JSON.stringify([{ toBottom: true, cells }]),
    });

    return json(res, 201, {
      ok: true,
      sheetId: getSheetId(),
      result,
      warning,
    });
  } catch (error) {
    return json(res, error.statusCode || 500, {
      error: "SMARTSHEET_CREATE_FAILED",
      message: error.message,
      details: error.details,
    });
  }
};
