const { getSheetId, json } = require("./_smartsheet");

const SMARTSHEET_API_BASE = "https://api.smartsheet.com/2.0";
const MAX_ATTACHMENT_BYTES = 4.2 * 1024 * 1024;

const MIME_BY_EXTENSION = {
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Metodo non consentito." });
  }

  const rowId = String(req.query.rowId || "").trim();
  if (!/^\d+$/.test(rowId)) {
    return json(res, 400, { error: "VALIDATION_ERROR", message: "Row ID Smartsheet mancante o non valido." });
  }

  try {
    const file = await readMultipartFile(req);
    const validatedFile = validateFile(file);
    const uploaded = await uploadToSmartsheet(rowId, validatedFile);

    return json(res, 201, {
      ok: true,
      rowId,
      attachment: uploaded,
    });
  } catch (error) {
    return json(res, error.statusCode || 500, {
      error: "SMARTSHEET_ATTACHMENT_UPLOAD_FAILED",
      message: error.message || "Impossibile caricare l'allegato.",
      details: error.details,
    });
  }
};

async function readMultipartFile(req) {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) {
    const error = new Error("Richiesta allegato non valida: boundary multipart mancante.");
    error.statusCode = 400;
    throw error;
  }

  const body = await readRequestBuffer(req);
  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  const parts = splitMultipartBody(body, boundary);

  for (const part of parts) {
    const separatorIndex = part.indexOf("\r\n\r\n");
    if (separatorIndex === -1) continue;

    const rawHeaders = part.slice(0, separatorIndex).toString("utf8");
    const content = trimTrailingLineBreak(part.slice(separatorIndex + 4));
    const disposition = rawHeaders.match(/content-disposition:\s*form-data;\s*([^\r\n]+)/i)?.[1] || "";
    const name = disposition.match(/name="([^"]+)"/i)?.[1] || "";
    const filename = disposition.match(/filename="([^"]*)"/i)?.[1] || "";

    if (name !== "file" || !filename) continue;

    return {
      name: sanitizeFilename(filename),
      type: rawHeaders.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || "application/octet-stream",
      bytes: content,
    };
  }

  const error = new Error("Nessun file trovato nella richiesta di upload.");
  error.statusCode = 400;
  throw error;
}

function validateFile(file) {
  if (!file.name) {
    const error = new Error("Nome file mancante.");
    error.statusCode = 400;
    throw error;
  }

  if (!file.bytes?.length) {
    const error = new Error(`Il file "${file.name}" e vuoto.`);
    error.statusCode = 400;
    throw error;
  }

  if (file.bytes.length > MAX_ATTACHMENT_BYTES) {
    const error = new Error(`Il file "${file.name}" supera il limite di 4,2 MB per allegato caricato dal sito.`);
    error.statusCode = 413;
    throw error;
  }

  const extension = file.name.match(/\.([a-z0-9]{1,12})$/i)?.[1]?.toLowerCase() || "";
  const type = MIME_BY_EXTENSION[extension] || file.type || "application/octet-stream";

  return {
    ...file,
    type,
  };
}

async function uploadToSmartsheet(rowId, file) {
  const token = process.env.SMARTSHEET_ACCESS_TOKEN || process.env.SMARTSHEET_TOKEN;
  if (!token) {
    const error = new Error("Variabile d'ambiente SMARTSHEET_ACCESS_TOKEN non configurata.");
    error.statusCode = 500;
    throw error;
  }

  const formData = new FormData();
  const blob = new Blob([file.bytes], { type: file.type });
  formData.append("file", blob, file.name);

  const response = await fetch(`${SMARTSHEET_API_BASE}/sheets/${getSheetId()}/rows/${rowId}/attachments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  const data = await parseSmartsheetResponse(response);

  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `Errore Smartsheet ${response.status}`);
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

async function parseSmartsheetResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (contentType.includes("application/json")) {
    try {
      return text ? JSON.parse(text) : null;
    } catch (error) {
      return { raw: text };
    }
  }

  return text ? { raw: text, message: text } : null;
}

async function readRequestBuffer(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function splitMultipartBody(body, boundary) {
  const parts = [];
  let start = body.indexOf(boundary);

  while (start !== -1) {
    start += boundary.length;
    if (body[start] === 45 && body[start + 1] === 45) break;
    if (body[start] === 13 && body[start + 1] === 10) start += 2;

    const end = body.indexOf(boundary, start);
    if (end === -1) break;
    parts.push(trimTrailingLineBreak(body.slice(start, end)));
    start = end;
  }

  return parts;
}

function trimTrailingLineBreak(buffer) {
  let end = buffer.length;
  while (end >= 2 && buffer[end - 2] === 13 && buffer[end - 1] === 10) {
    end -= 2;
  }
  return buffer.slice(0, end);
}

function sanitizeFilename(name) {
  return String(name || "")
    .split(/[\\/]/)
    .pop()
    .replace(/[\r\n"]/g, "")
    .trim();
}
