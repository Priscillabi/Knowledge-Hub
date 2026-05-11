const DEFAULT_BASE_URL = "https://api.smartsheet.com/2.0";
const DEFAULT_SHEET_NAME = "Knowledge Hub";

function getConfig() {
  const token = process.env.SMARTSHEET_ACCESS_TOKEN;
  const workspaceId = process.env.SMARTSHEET_WORKSPACE_ID;
  const sheetId = process.env.SMARTSHEET_SHEET_ID;
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
    sheetId: sheetId ? String(sheetId) : null,
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

function findSheet(workspace, config) {
  const sheets = collectSheets(workspace);

  if (config.sheetId) {
    return sheets.find((sheet) => sheet.id === config.sheetId);
  }

  const normalizedTarget = config.sheetName.trim().toLowerCase();
  return sheets.find(
    (sheet) =>
      String(sheet.name || "").trim().toLowerCase() === normalizedTarget ||
      sheet.id === String(config.sheetName),
  );
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const attachmentId = request.query.attachmentId ? String(request.query.attachmentId) : "";

    if (!attachmentId) {
      response.status(400).json({
        error: "Missing attachmentId",
        message: "attachmentId query parameter is required.",
      });
      return;
    }

    const config = getConfig();
    const workspace = await smartsheetFetch(`/workspaces/${config.workspaceId}`, config);
    const targetSheet = findSheet(workspace, config);

    if (!targetSheet) {
      response.status(404).json({
        error: "Sheet not found",
        message: `Sheet "${config.sheetId || config.sheetName}" was not found inside the configured workspace.`,
      });
      return;
    }

    const attachment = await smartsheetFetch(`/sheets/${targetSheet.id}/attachments/${attachmentId}`, config);

    if (!attachment.url) {
      response.status(404).json({
        error: "Attachment URL unavailable",
        message: "Smartsheet did not return an openable URL for this attachment.",
      });
      return;
    }

    response.status(200).json({
      id: String(attachment.id || attachmentId),
      name: attachment.name || "Allegato",
      attachmentType: attachment.attachmentType || "",
      attachmentSubType: attachment.attachmentSubType || "",
      mimeType: attachment.mimeType || "",
      sizeInKb: attachment.sizeInKb ?? null,
      url: attachment.url,
      urlExpiresInMillis: attachment.urlExpiresInMillis ?? null,
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: "Smartsheet attachment request failed",
      message: error.message,
    });
  }
};
