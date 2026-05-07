const DEFAULT_BASE_URL = "https://api.smartsheet.com/2.0";

function getConfig() {
  const token = process.env.SMARTSHEET_ACCESS_TOKEN;
  const workspaceId = process.env.SMARTSHEET_WORKSPACE_ID;
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
        permalink: sheet.permalink,
      });
    });
  }

  if (Array.isArray(node.folders)) {
    node.folders.forEach((folder) => collectSheets(folder, sheets));
  }

  return sheets;
}

function normalizeSheet(sheet) {
  const columnsById = new Map(
    (sheet.columns || []).map((column) => [
      String(column.id),
      {
        id: String(column.id),
        title: column.title,
        type: column.type,
      },
    ]),
  );

  return {
    id: String(sheet.id),
    name: sheet.name,
    permalink: sheet.permalink,
    columns: Array.from(columnsById.values()),
    rows: (sheet.rows || []).map((row) => ({
      id: String(row.id),
      rowNumber: row.rowNumber,
      cells: (row.cells || []).map((cell) => {
        const column = columnsById.get(String(cell.columnId));

        return {
          columnId: String(cell.columnId),
          columnTitle: column?.title,
          value: cell.value ?? null,
          displayValue: cell.displayValue ?? null,
        };
      }),
    })),
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
    const allowedSheets = collectSheets(workspace);
    const requestedSheetId = request.query.sheetId ? String(request.query.sheetId) : null;

    if (!requestedSheetId) {
      response.status(200).json({
        workspace: {
          id: config.workspaceId,
          name: workspace.name,
        },
        sheets: allowedSheets,
      });
      return;
    }

    const isAllowed = allowedSheets.some((sheet) => sheet.id === requestedSheetId);

    if (!isAllowed) {
      response.status(403).json({
        error: "Sheet not allowed",
        message: "This API only reads sheets inside the configured Smartsheet workspace.",
      });
      return;
    }

    const sheet = await smartsheetFetch(`/sheets/${requestedSheetId}`, config);

    response.status(200).json({
      workspace: {
        id: config.workspaceId,
        name: workspace.name,
      },
      sheet: normalizeSheet(sheet),
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: "Smartsheet API request failed",
      message: error.message,
    });
  }
};
