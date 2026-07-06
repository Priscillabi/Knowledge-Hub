const { getSheetId, json, smartsheetFetch, normalizeRow } = require("./_smartsheet");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, { error: "Metodo non consentito." });
  }

  try {
    const sheet = await smartsheetFetch(`/sheets/${getSheetId()}?include=attachments`);
    const columnsById = new Map((sheet.columns || []).map((column) => [column.id, column]));

    return json(res, 200, {
      workspace: {
        id: process.env.SMARTSHEET_WORKSPACE_ID || "",
        name: process.env.SMARTSHEET_WORKSPACE_NAME || "Innovation Clinic: Know-How Center",
      },
      sheet: {
        id: String(sheet.id || getSheetId()),
        name: sheet.name || "Knowledge Hub",
        totalRowCount: sheet.totalRowCount || 0,
        columns: (sheet.columns || []).map((column) => column.title),
        entries: (sheet.rows || []).map((row) => normalizeRow(row, columnsById)),
      },
    });
  } catch (error) {
    return json(res, error.statusCode || 500, {
      error: "SMARTSHEET_READ_FAILED",
      message: error.message,
      details: error.details,
    });
  }
};
