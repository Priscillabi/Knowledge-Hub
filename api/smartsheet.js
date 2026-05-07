const DEFAULT_BASE_URL = "https://api.smartsheet.com/2.0";
const DEFAULT_SHEET_NAME = "Knowledge Hub";

function getConfig() {
  const token = process.env.SMARTSHEET_ACCESS_TOKEN;
  const workspaceId = process.env.SMARTSHEET_WORKSPACE_ID;
  const sheetName = process.env.SMARTSHEET_SHEET_NAME || DEFAULT_SHEET_NAME;
  const baseUrl = process.env.SMARTSHEET_BASE_URL || DEFAULT_BASE_URL;

  if (!token || !workspaceId) {
    const missing = [
      !token ? "SMARTSHEET_ACCESS_TOKEN" : null,
      !workspaceId ? "SMARTSHEET_WORKSPACE_ID" : null,
    ].filter(Boolean);

    throw new Error(`Missing environment variable(s): ${missing.join(", ")}`);
  }

  return {
    token,
    workspaceId: String(workspaceId),
    sheetName,
    baseUrl: baseUrl.replace(/\/$/, ""),
  };
}

async function smartsheetFetch(path, config) {
  const response = await fetch(`${config.baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message || `Smartsheet API error ${response.status}`;
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  return data;
}

function collectSheets(node, sheets = []) {
  if (!node || typeof node !== "object") {
    return sheets;
  }

  if (Array.isArray(node.sheets)) {
    node.sheets.forEach((sheet) => {
      sheets.push({
        id: String(sheet.id),
        name: sheet.name,
      });
    });
  }

  if (Array.isArray(node.folders)) {
    node.folders.forEach((folder) => collectSheets(folder, sheets));
  }

  return sheets;
}

function findSheetByName(workspace, targetName) {
  const normalizedTarget = targetName.trim().toLowerCase();
  return collectSheets(workspace).find(
    (sheet) => String(sheet.name || "").trim().toLowerCase() === normalizedTarget,
  );
}

function cellText(cell) {
  if (!cell) {
    return "";
  }

  return String(cell.displayValue ?? cell.value ?? "").trim();
}

function rowToEntry(row, columnsById, index) {
  const values = {};

  (row.cells || []).forEach((cell) => {
    const title = columnsById.get(String(cell.columnId));
    if (title) {
      values[title] = cellText(cell);
    }
  });

  return {
    id: String(row.id || index + 1),
    rowNumber: row.rowNumber,
    tag: values["TAG"] || "",
    desc: values["Descrizione"] || "",
    query: values["Inserire Formula o Query"] || "",
    tipo: values["Tipologia di contenuto"] || "",
    strumento: values["Strumento"] || "",
    autore: values["Inserita da"] || "",
    tagRicerca: values["TAG - Ricerca"] || "",
  };
}

function normalizeKnowledgeHubSheet(sheet) {
  const columnsById = new Map(
    (sheet.columns || []).map((column) => [String(column.id), column.title]),
  );

  const entries = (sheet.rows || [])
    .map((row, index) => rowToEntry(row, columnsById, index))
    .filter((entry) => entry.desc || entry.tag || entry.query);

  return {
    id: String(sheet.id),
    name: sheet.name,
    totalRowCount: sheet.totalRowCount,
    columns: Array.from(columnsById.values()),
    entries,
  };
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const config = getConfig();
    const workspace = await smartsheetFetch(`/workspaces/${config.workspaceId}`, config);
    const targetSheet = findSheetByName(workspace, config.sheetName);

    if (!targetSheet) {
      response.status(404).json({
        error: "Sheet not found",
        message: `Sheet "${config.sheetName}" was not found inside the configured workspace.`,
      });
      return;
    }

    const sheet = await smartsheetFetch(`/sheets/${targetSheet.id}`, config);

    response.status(200).json({
      workspace: {
        id: config.workspaceId,
        name: workspace.name,
      },
      sheet: normalizeKnowledgeHubSheet(sheet),
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: "Smartsheet API request failed",
      message: error.message,
    });
  }
};
