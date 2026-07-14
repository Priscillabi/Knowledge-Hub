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
  payload.attachments = Array.isArray(body.attachments)
    ? body.attachments
        .map((item) => ({
          name: String(item?.name || "").trim(),
          type: String(item?.type || "application/octet-stream").trim(),
          dataBase64: String(item?.dataBase64 || "").trim(),
        }))
        .filter((item) => item.name && item.dataBase64)
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
  if (!payload.title) missing.push("Titolo Iniziativa");
  if (!payload.tipo) missing.push("Tipologia di contenuto");
  if (payload.tipo === "Issue - Workaround" && !payload.workaround) missing.push("Hai trovato un workaround?");
  if (!payload.strumenti.length) missing.push("Strumento");

  if (missing.length) return `Compila i campi obbligatori: ${missing.join(", ")}.`;
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
    addCell(cells, columns, "Strumento", payload.strumenti.join(", "));
    addCell(cells, columns, "Descrizione", payload.desc);
    addCell(cells, columns, "Workaround", payload.workaround);
    addCell(cells, columns, "Inserire Formula o Query", payload.query);
    addCell(cells, columns, "TAG", payload.tag);
    addCell(cells, columns, "TAG - Ricerca", payload.tagRicerca);
    addCell(cells, columns, "Inserita da", payload.autore);
    addCell(cells, columns, "Data Inserimento", new Date().toISOString());
    addCell(cells, columns, "TAG - Tipologia di contenuto", payload.tipo);
    addCell(cells, columns, "TAG - Strumento", payload.strumenti.join(", "));

    payload.normalizedStrumenti.forEach((tool) => {
      const config = selectedToolConfig(tool);
      if (!config) return;

      const functionalityValues = Array.isArray(payload.functionalities[tool]) ? payload.functionalities[tool] : [];
      const otherDetail = String(payload.otherDetails[tool] || "").trim();

      addCell(cells, columns, config.markerColumn, "Si");
      addCell(cells, columns, config.technicalColumn, functionalityValues.join(", "));
      addCell(cells, columns, config.altroColumn, otherDetail);
      addCell(cells, columns, config.listColumn, functionalityValues.join(", "));
    });

    const result = await smartsheetFetch(`/sheets/${getSheetId()}/rows`, {
      method: "POST",
      body: JSON.stringify([{ toBottom: true, cells }]),
    });
    const rowId = result?.result?.[0]?.id;
    const uploadedAttachments = rowId ? await uploadAttachments(rowId, payload.attachments) : [];

    return json(res, 201, {
      ok: true,
      sheetId: getSheetId(),
      result,
      uploadedAttachments,
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

async function uploadAttachments(rowId, attachments) {
  if (!attachments.length) return [];

  const uploaded = [];
  for (const attachment of attachments) {
    const formData = new FormData();
    const bytes = Buffer.from(attachment.dataBase64, "base64");
    const blob = new Blob([bytes], { type: attachment.type || "application/octet-stream" });
    formData.append("file", blob, attachment.name);

    const response = await fetch(`https://api.smartsheet.com/2.0/sheets/${getSheetId()}/rows/${rowId}/attachments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SMARTSHEET_ACCESS_TOKEN || process.env.SMARTSHEET_TOKEN}`,
      },
      body: formData,
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(data?.message || `Errore caricamento allegato ${attachment.name}`);
      error.statusCode = response.status;
      error.details = data;
      throw error;
    }

    uploaded.push(data);
  }

  return uploaded;
}
