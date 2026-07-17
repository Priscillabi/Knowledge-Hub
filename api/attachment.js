const { getSheetId, json, smartsheetFetch } = require("./_smartsheet");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, { error: "Metodo non consentito." });
  }

  const attachmentId = String(req.query.attachmentId || "").trim();
  if (!attachmentId) {
    return json(res, 400, { error: "Attachment ID mancante." });
  }

  try {
    // Attachment URLs must be requested in the context of the sheet that owns them.
    const attachment = await smartsheetFetch(`/sheets/${getSheetId()}/attachments/${encodeURIComponent(attachmentId)}`);
    const mode = String(req.query.mode || "metadata").trim();

    if (mode === "preview" || mode === "download") {
      return streamAttachment(res, attachment, mode);
    }

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

async function streamAttachment(res, attachment, mode) {
  if (!attachment.url) {
    return json(res, 404, {
      error: "ATTACHMENT_URL_UNAVAILABLE",
      message: "URL allegato non disponibile.",
    });
  }

  const response = await fetch(attachment.url);
  if (!response.ok) {
    return json(res, response.status, {
      error: "ATTACHMENT_FETCH_FAILED",
      message: "Impossibile recuperare il file da Smartsheet.",
    });
  }

  const filename = safeFilename(attachment.name || "allegato");
  const contentType = attachment.mimeType || response.headers.get("content-type") || "application/octet-stream";
  const disposition = mode === "download" ? "attachment" : "inline";
  const bytes = Buffer.from(await response.arrayBuffer());

  res.statusCode = 200;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Length", String(bytes.length));
  res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.end(bytes);
}

function safeFilename(name) {
  return String(name || "allegato").replace(/[\r\n"]/g, "").trim() || "allegato";
}
