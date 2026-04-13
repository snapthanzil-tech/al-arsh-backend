const DASHBOARD_PASSCODE = "2020";
const PASSCODE_STORAGE_KEY = "al-arsh-dashboard-unlocked";

function lockDashboard() {
  document.body.classList.add("locked");
}

function unlockDashboard(overlay) {
  document.body.classList.remove("locked");
  window.localStorage.setItem(PASSCODE_STORAGE_KEY, "true");

  if (overlay) {
    overlay.classList.add("is-hidden");
    overlay.setAttribute("hidden", "hidden");
    overlay.style.display = "none";
  }
}

function setupSignOut() {
  const signoutButton = document.getElementById("signout-button");
  const overlay = document.getElementById("passcode-overlay");
  const input = document.getElementById("passcode-input");
  const error = document.getElementById("passcode-error");

  signoutButton.addEventListener("click", () => {
    window.localStorage.removeItem(PASSCODE_STORAGE_KEY);
    document.body.classList.add("locked");
    overlay.hidden = false;
    overlay.classList.remove("is-hidden");
    overlay.style.display = "grid";
    input.value = "";
    error.textContent = "";
    input.focus();
  });
}

function initializePasscodeGate() {
  const overlay = document.getElementById("passcode-overlay");
  const form = document.getElementById("passcode-form");
  const input = document.getElementById("passcode-input");
  const error = document.getElementById("passcode-error");
  const isUnlocked = window.localStorage.getItem(PASSCODE_STORAGE_KEY) === "true";

  if (isUnlocked) {
    unlockDashboard(overlay);
    return true;
  }

  lockDashboard();
  input.focus();

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (input.value === DASHBOARD_PASSCODE) {
      error.textContent = "";
      unlockDashboard(overlay);
      loadHealth();
      loadDashboardSummary();
      return;
    }

    error.textContent = "Wrong passcode. Try again.";
    input.value = "";
    input.focus();
  });

  return false;
}

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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatAmount(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(Number(value) || 0));
}

function renderTopMetrics(summary) {
  document.getElementById("total-works").textContent = String(summary.totalWorks || 0);
  document.getElementById("total-amount").textContent = formatAmount(summary.totalAmount || 0);
  document.getElementById("delivered-count").textContent = String(summary.deliveredCount || 0);
  document.getElementById("unpaid-amount").textContent = formatAmount(summary.unpaidAmount || 0);
  document.getElementById("first-year").textContent = String(summary.firstYear || "--");
  document.getElementById("strongest-year").textContent = String(summary.strongestYear?.year || "--");
  document.getElementById("strongest-year-note").textContent = summary.strongestYear
    ? `${summary.strongestYear.works} jobs and ${formatAmount(summary.strongestYear.amount)} total value`
    : "Highest work volume seen in the sheet.";
  document.getElementById("top-client-name").textContent = summary.strongestClient?.name || "--";
  document.getElementById("top-client-note").textContent = summary.strongestClient
    ? `${summary.strongestClient.count} jobs and ${formatAmount(summary.strongestClient.amount)} value`
    : "Highest repeat client from the current records.";
  document.getElementById("top-emirate-name").textContent = summary.strongestEmirate?.name || "--";
  document.getElementById("top-emirate-note").textContent = summary.strongestEmirate
    ? `${summary.strongestEmirate.count} jobs and ${formatAmount(summary.strongestEmirate.amount)} value`
    : "Main operating market based on project records.";
}

function renderYearSummary(summary) {
  const yearSummaryEl = document.getElementById("year-summary");

  if (!summary.yearly || summary.yearly.length === 0) {
    yearSummaryEl.innerHTML = '<div class="summary-empty">No year-wise summary available from the LPO sheet.</div>';
    return;
  }

  const growthByYear = new Map((summary.yearlyGrowth || []).map((item) => [item.year, item.delta]));

  yearSummaryEl.innerHTML = summary.yearly
    .map((item) => {
      const delta = growthByYear.get(item.year) || 0;
      const deltaLabel = delta >= 0 ? `+${delta}` : String(delta);

      return `
        <div class="year-card">
          <span class="year-badge">${escapeHtml(item.year)}</span>
          <div class="year-meta">
            <strong>${escapeHtml(item.works)} jobs in ${escapeHtml(item.year)}</strong>
            <span>${escapeHtml(item.invoices)} invoices, ${escapeHtml(item.delivered)} delivered, top client ${escapeHtml(item.topClient || "Unknown")}</span>
          </div>
          <div class="year-side">
            <span class="year-total">${escapeHtml(formatAmount(item.amount))}</span>
            <span class="delta-chip">${escapeHtml(deltaLabel)} jobs</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderMonthlySummary(summary) {
  const monthSummaryEl = document.getElementById("month-summary");

  if (!summary.monthly || summary.monthly.length === 0) {
    monthSummaryEl.innerHTML = '<div class="summary-empty">No month-wise movement available for the latest year.</div>';
    return;
  }

  monthSummaryEl.innerHTML = summary.monthly
    .map(
      (item) => `
        <div class="month-card">
          <span class="month-badge">${escapeHtml(item.month)}</span>
          <div class="month-meta">
            <strong>${escapeHtml(summary.latestYear)} monthly movement</strong>
            <span>Delivered ${escapeHtml(item.delivered || 0)}, unpaid ${escapeHtml(formatAmount(item.unpaid || 0))}</span>
          </div>
          <div class="year-side">
            <span class="month-total">${escapeHtml(item.works)}</span>
            <span class="delta-chip">${escapeHtml(formatAmount(item.amount))}</span>
          </div>
        </div>
      `
    )
    .join("");
}

function renderRankList(targetId, items, helperText, amountKey = "amount") {
  const target = document.getElementById(targetId);

  if (!items || items.length === 0) {
    target.innerHTML = `<div class="summary-empty">No ${helperText.toLowerCase()} found in the current LPO sheet.</div>`;
    return;
  }

  target.innerHTML = items
    .map(
      (item) => `
        <div class="insight-card">
          <div>
            <strong>${escapeHtml(item.name || item.client || "Unknown")}</strong>
            <span>${escapeHtml(helperText)}</span>
          </div>
          <div class="insight-side">
            <span class="insight-count">${escapeHtml(item.count ?? "--")}</span>
            ${item[amountKey] ? `<span class="insight-amount">${escapeHtml(formatAmount(item[amountKey]))}</span>` : ""}
          </div>
        </div>
      `
    )
    .join("");
}

function renderJobList(targetId, items, helperText) {
  const target = document.getElementById(targetId);

  if (!items || items.length === 0) {
    target.innerHTML = `<div class="summary-empty">No ${helperText.toLowerCase()} found in the current sheet.</div>`;
    return;
  }

  target.innerHTML = items
    .map(
      (item) => `
        <div class="insight-card job-card">
          <div>
            <strong>${escapeHtml(item.client || "Unknown client")}</strong>
            <span>${escapeHtml(item.project || "Unknown project")}</span>
          </div>
          <div class="insight-side">
            <span class="insight-count">${escapeHtml(formatAmount(item.amount || 0))}</span>
            <span class="insight-amount">${escapeHtml(item.status || helperText)}</span>
          </div>
        </div>
      `
    )
    .join("");
}

function renderDashboardSummary(summary) {
  renderTopMetrics(summary);
  renderYearSummary(summary);
  renderMonthlySummary(summary);
  renderRankList("top-clients", summary.topClients, "Jobs and value by client");
  renderRankList("top-projects", summary.topProjects, "Repeated project names", "amount");
  renderRankList("top-emirates", summary.topEmirates, "Jobs and value by emirate");
  renderJobList("pending-jobs", summary.pendingJobs, "Pending delivery");
  renderJobList("unpaid-jobs", summary.unpaidJobs, "Amount not received");
  initAutoSlider();
}

function renderSummaryError() {
  document.getElementById("total-works").textContent = "--";
  document.getElementById("total-amount").textContent = "--";
  document.getElementById("delivered-count").textContent = "--";
  document.getElementById("unpaid-amount").textContent = "--";
  document.getElementById("first-year").textContent = "--";
  document.getElementById("strongest-year").textContent = "--";
  document.getElementById("top-client-name").textContent = "--";
  document.getElementById("top-emirate-name").textContent = "--";
  document.getElementById("year-summary").innerHTML =
    '<div class="summary-empty">Dashboard summary could not be loaded from the LPO sheet.</div>';
  document.getElementById("month-summary").innerHTML =
    '<div class="summary-empty">Monthly movement is unavailable right now.</div>';
  document.getElementById("top-clients").innerHTML =
    '<div class="summary-empty">Client insights are unavailable right now.</div>';
  document.getElementById("top-projects").innerHTML =
    '<div class="summary-empty">Project insights are unavailable right now.</div>';
  document.getElementById("top-emirates").innerHTML =
    '<div class="summary-empty">Emirate insights are unavailable right now.</div>';
  document.getElementById("pending-jobs").innerHTML =
    '<div class="summary-empty">Pending delivery jobs are unavailable right now.</div>';
  document.getElementById("unpaid-jobs").innerHTML =
    '<div class="summary-empty">Collection insights are unavailable right now.</div>';
}

function initAutoSlider() {
  document.querySelectorAll(".slider-row").forEach((slider) => {
    if (slider.dataset.autoSliderReady === "true") {
      return;
    }

    slider.dataset.autoSliderReady = "true";

    let paused = false;
    let animationFrameId = null;
    const originalCards = [...slider.children];

    if (originalCards.length <= 1) {
      return;
    }

    originalCards.forEach((card) => {
      const clone = card.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      slider.appendChild(clone);
    });

    const originalWidth = [...originalCards].reduce((total, card) => total + card.offsetWidth + 12, 0);

    const tick = () => {
      if (!paused && slider.scrollWidth > slider.clientWidth) {
        slider.scrollLeft += 0.45;

        if (slider.scrollLeft >= originalWidth) {
          slider.scrollLeft -= originalWidth;
        }
      }

      animationFrameId = window.requestAnimationFrame(tick);
    };

    slider.addEventListener("mouseenter", () => {
      paused = true;
    });

    slider.addEventListener("mouseleave", () => {
      paused = false;
    });

    slider.addEventListener("touchstart", () => {
      paused = true;
    });

    slider.addEventListener("touchend", () => {
      paused = false;
    });

    animationFrameId = window.requestAnimationFrame(tick);

    slider.addEventListener("remove", () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    });
  });
}

async function loadDashboardSummary() {
  try {
    const response = await fetch("/api/dashboard-summary");
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Failed to load dashboard summary");
    }

    renderDashboardSummary(data.summary || {});
  } catch (error) {
    renderSummaryError();
  }
}

if (initializePasscodeGate()) {
  loadHealth();
  loadDashboardSummary();
}

setupSignOut();
