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
    "nomeCognome",
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
  payload.strumenti = Array.isArray(body.strumenti)
    ? body.strumenti.map((item) => String(item || "").trim()).filter(Boolean)
    : splitValues(payload.strumento);
  payload.normalizedStrumenti = Array.isArray(body.normalizedStrumenti)
    ? body.normalizedStrumenti.map((item) => String(item || "").trim()).filter(Boolean)
    : payload.strumenti.map(normalizedToolName);
  payload.functionalities = body.functionalities && typeof body.functionalities === "object" ? body.functionalities : {};
  payload.otherDetails = body.otherDetails && typeof body.otherDetails === "object" ? body.otherDetails : {};
  payload.attachmentNames = Array.isArray(body.attachmentNames)
    ? body.attachmentNames.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  return payload;
}

function normalizedToolName(tool) {
  const aliases = {
    "Power BI (linguaggio: DAX)": "Power BI",
    "Power Query (linguaggio: M)": "Power Query",
  };
  return aliases[tool] || tool;
}

function splitValues(value) {
  return String(value || "")
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function validatePayload(payload) {
  const missing = [];
  if (!payload.nomeCognome) missing.push("Nome e Cognome");
  if (!payload.title) missing.push("Titolo Informazione");
  if (!payload.tipo) missing.push("Tipologia di contenuto");
  if (payload.tipo === "Issue - Workaround" && !payload.workaround) missing.push("Hai trovato un workaround?");
  if (!payload.strumenti.length) missing.push("Strumento");

  if (missing.length) return `Compila i campi obbligatori: ${missing.join(", ")}.`;
  return "";
}

function requireTitleColumn(columns) {
  if (columns.has("Titolo Informazione")) {
    return { columnName: "Titolo Informazione", warning: "" };
  }

  if (columns.has("Titolo Iniziativa")) {
    return {
      columnName: "Titolo Iniziativa",
      warning: "La colonna 'Titolo Informazione' non esiste: il valore e stato scritto nella colonna storica 'Titolo Iniziativa'.",
    };
  }

  const error = new Error("Nel foglio non esiste la colonna 'Titolo Informazione' ne la colonna fallback 'Titolo Iniziativa'.");
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
    const cells = [];

    addCell(cells, columns, "Nome e Cognome", payload.nomeCognome);
    addCell(cells, columns, titleColumnName, payload.title);
    addCell(cells, columns, "Tipologia di contenuto", payload.tipo);
    addCell(cells, columns, "Strumento", payload.strumenti.join(", "));
    addCell(cells, columns, "Descrizione", payload.desc);
    addCell(cells, columns, "Workaround", payload.workaround);
    addCell(cells, columns, "Inserire Formula o Query", payload.query);

    payload.normalizedStrumenti.forEach((tool) => {
      const config = selectedToolConfig(tool);
      if (!config) return;

      const functionalityValues = Array.isArray(payload.functionalities[tool]) ? payload.functionalities[tool] : [];
      const otherDetail = String(payload.otherDetails[tool] || "").trim();

      addCell(cells, columns, config.technicalColumn, functionalityValues.join(", "));
      addCell(cells, columns, config.altroColumn, otherDetail);
    });

    const result = await smartsheetFetch(`/sheets/${getSheetId()}/rows`, {
      method: "POST",
      body: JSON.stringify([{ toBottom: true, cells }]),
    });
    const rowId = result?.result?.[0]?.id;

    return json(res, 201, {
      ok: true,
      sheetId: getSheetId(),
      rowId,
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
