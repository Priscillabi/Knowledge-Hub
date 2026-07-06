const { json, smartsheetFetch } = require("./_smartsheet");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, { error: "Metodo non consentito." });
  }

  const attachmentId = String(req.query.attachmentId || "").trim();
  if (!attachmentId) {
    return json(res, 400, { error: "Attachment ID mancante." });
  }

  try {
    const attachment = await smartsheetFetch(`/attachments/${encodeURIComponent(attachmentId)}`);
    return json(res, 200, {
      id: String(attachment.id || attachmentId),
      name: attachment.name || "",
      url: attachment.url || "",
      urlExpiresInMillis: attachment.urlExpiresInMillis || null,
    });
  } catch (error) {
    return json(res, error.statusCode || 500, {
      error: "SMARTSHEET_ATTACHMENT_FAILED",
      message: error.message,
      details: error.details,
    });
  }
};
