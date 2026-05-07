const statusEl = document.querySelector("#status");
const sheetsEl = document.querySelector("#sheets");
const sheetCountEl = document.querySelector("#sheet-count");
const sheetTitleEl = document.querySelector("#sheet-title");
const sheetSubtitleEl = document.querySelector("#sheet-subtitle");
const tableHeadEl = document.querySelector("#table-head");
const tableBodyEl = document.querySelector("#table-body");
const refreshButton = document.querySelector("#refresh-button");

let activeSheetId = null;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

async function requestJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || `Errore ${response.status}`);
  }

  return data;
}

function clearTable() {
  tableHeadEl.innerHTML = "";
  tableBodyEl.innerHTML = "";
}

function renderSheets(sheets) {
  sheetsEl.innerHTML = "";
  sheetCountEl.textContent = String(sheets.length);

  if (!sheets.length) {
    sheetsEl.innerHTML = '<p class="empty">Nessun foglio trovato nel workspace configurato.</p>';
    return;
  }

  sheets.forEach((sheet) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sheet-button";
    button.textContent = sheet.name || `Sheet ${sheet.id}`;
    button.dataset.sheetId = sheet.id;
    button.addEventListener("click", () => loadSheet(sheet.id));
    sheetsEl.append(button);
  });
}

function renderTable(sheet) {
  clearTable();

  sheetTitleEl.textContent = sheet.name || "Foglio Smartsheet";
  sheetSubtitleEl.textContent = `${sheet.rows.length} righe disponibili`;

  const headRow = document.createElement("tr");
  sheet.columns.forEach((column) => {
    const th = document.createElement("th");
    th.textContent = column.title;
    headRow.append(th);
  });
  tableHeadEl.append(headRow);

  sheet.rows.forEach((row) => {
    const tr = document.createElement("tr");
    sheet.columns.forEach((column) => {
      const td = document.createElement("td");
      const cell = row.cells.find((item) => item.columnId === column.id);
      td.textContent = cell?.displayValue ?? cell?.value ?? "";
      tr.append(td);
    });
    tableBodyEl.append(tr);
  });
}

function setActiveSheet(sheetId) {
  activeSheetId = sheetId;
  document.querySelectorAll(".sheet-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.sheetId === sheetId);
  });
}

async function loadWorkspace() {
  refreshButton.disabled = true;
  setStatus("Caricamento workspace Smartsheet...");
  clearTable();

  try {
    const data = await requestJson("/api/smartsheet");
    renderSheets(data.sheets || []);
    setStatus(`Workspace caricato: ${data.workspace?.name || data.workspace?.id || "configurato"}`);
  } catch (error) {
    renderSheets([]);
    setStatus(error.message, true);
  } finally {
    refreshButton.disabled = false;
  }
}

async function loadSheet(sheetId) {
  setActiveSheet(sheetId);
  setStatus("Caricamento dati del foglio...");
  clearTable();

  try {
    const data = await requestJson(`/api/smartsheet?sheetId=${encodeURIComponent(sheetId)}`);
    renderTable(data.sheet);
    setStatus("Dati aggiornati");
  } catch (error) {
    setStatus(error.message, true);
  }
}

refreshButton.addEventListener("click", () => {
  if (activeSheetId) {
    loadSheet(activeSheetId);
    return;
  }

  loadWorkspace();
});

loadWorkspace();
