async function loadHealth() {
  const statusEl = document.getElementById("backend-status");

  try {
    const response = await fetch("/api/health");
    const data = await response.json();

    statusEl.textContent = data.message;
  } catch (error) {
    statusEl.textContent = "Backend unavailable";
  }
}

function renderSheetTable(values) {
  const headEl = document.getElementById("sheet-head");
  const bodyEl = document.getElementById("sheet-body");
  const countEl = document.getElementById("sheet-count");
  const noteEl = document.getElementById("sheet-note");

  if (!Array.isArray(values) || values.length === 0) {
    bodyEl.innerHTML = '<tr><td colspan="6" class="loading">No rows found in Sheet1.</td></tr>';
    countEl.textContent = "0";
    noteEl.textContent = "Connected successfully, but Sheet1 returned no rows.";
    return;
  }

  const headerRow = values[0].slice(0, 6);
  const dataRows = values.slice(1, 7);

  headEl.innerHTML = `<tr>${headerRow
    .map((cell) => `<th>${cell || "Column"}</th>`)
    .join("")}</tr>`;

  bodyEl.innerHTML = dataRows
    .map(
      (row) =>
        `<tr>${headerRow
          .map((_, index) => `<td>${row[index] || "-"}</td>`)
          .join("")}</tr>`
    )
    .join("");

  countEl.textContent = String(Math.max(values.length - 1, 0));
  noteEl.textContent = "Live rows loaded from the deployed Google Sheet integration.";
}

async function loadSheetPreview() {
  const bodyEl = document.getElementById("sheet-body");
  const noteEl = document.getElementById("sheet-note");

  try {
    const response = await fetch("/api/sheet-test");
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Failed to load sheet preview");
    }

    renderSheetTable(data.values || []);
  } catch (error) {
    bodyEl.innerHTML =
      '<tr><td colspan="6" class="loading">Live sheet preview unavailable right now.</td></tr>';
    noteEl.textContent = "The dashboard loaded, but the Google Sheet preview could not be fetched.";
  }
}

loadHealth();
loadSheetPreview();
