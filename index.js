require("dotenv").config();

const path = require("path");
const express = require("express");
const { google } = require("googleapis");

const app = express();
const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");

app.use(express.json());
app.use(express.static(publicDir));

function hasPlaceholder(value) {
  return !value || value.includes("YOUR_") || value.includes("your_");
}

function parseSheetDate(value) {
  if (!value) {
    return null;
  }

  const text = String(value).trim();
  const dottedMatch = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);

  if (dottedMatch) {
    const day = Number(dottedMatch[1]);
    const month = Number(dottedMatch[2]);
    const year = Number(dottedMatch[3]);
    return new Date(year, month - 1, day);
  }

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    return new Date(year, month - 1, day);
  }

  return null;
}

function normalizeHeader(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[._]/g, " ")
    .trim();
}

function findHeaderIndex(headers, patterns) {
  return headers.findIndex((header) => patterns.some((pattern) => header.includes(pattern)));
}

function findBestHeaderIndex(headers, exactPatterns, fallbackPatterns) {
  const exactIndex = headers.findIndex((header) => exactPatterns.includes(header));

  if (exactIndex >= 0) {
    return exactIndex;
  }

  return findHeaderIndex(headers, fallbackPatterns);
}

function parseAmount(value) {
  const parsed = Number(String(value || "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function detectEmirate(project) {
  const text = String(project || "").toLowerCase();

  if (text.includes("dubai") || text.includes("jumeirah") || text.includes("jebel ali")) return "Dubai";
  if (text.includes("sharjah") || text.includes("shj")) return "Sharjah";
  if (text.includes("ajman")) return "Ajman";
  if (text.includes("abudhabi") || text.includes("abu dhabi")) return "Abu Dhabi";
  if (text.includes("umm al quwain")) return "Umm Al Quwain";
  if (text.includes("ras al khaimah") || text.includes("rak")) return "Ras Al Khaimah";
  if (text.includes("fujairah")) return "Fujairah";

  return project ? "Other / Mixed" : "Unknown";
}

function findRowDate(row) {
  for (const cell of row) {
    const parsed = parseSheetDate(cell);

    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function getSheetsClient() {
  const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY } = process.env;

  if (hasPlaceholder(GOOGLE_SERVICE_ACCOUNT_EMAIL) || hasPlaceholder(GOOGLE_PRIVATE_KEY)) {
    throw new Error("Missing required Google Sheets configuration");
  }

  const normalizedPrivateKey = GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n").trim();

  const auth = new google.auth.JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: normalizedPrivateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4" });

  return { auth, sheets };
}

async function fetchSheetValues() {
  const { GOOGLE_SHEET_ID } = process.env;

  if (hasPlaceholder(GOOGLE_SHEET_ID)) {
    throw new Error("Missing required Google Sheets configuration");
  }

  const { auth, sheets } = getSheetsClient();
  await auth.authorize();

  const response = await sheets.spreadsheets.values.get({
    auth,
    spreadsheetId: GOOGLE_SHEET_ID,
    range: "Sheet1",
  });

  return response.data.values || [];
}

function buildDashboardSummary(values) {
  const headers = (values[0] || []).map(normalizeHeader);
  const rows = values.slice(1);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const invoiceIndex = findBestHeaderIndex(headers, ["invoice no", "invoice no.", "invoice"], ["invoice no", "invoice"]);
  const amountIndex = findBestHeaderIndex(headers, ["amount"], ["amount"]);
  const statusIndex = findBestHeaderIndex(headers, ["delivery status"], ["delivery status", "status"]);
  const clientIndex = findBestHeaderIndex(headers, ["client name"], ["client name"]);
  const projectIndex = findBestHeaderIndex(headers, ["project"], ["project"]);
  const amountReceivedIndex = findBestHeaderIndex(
    headers,
    ["amount rcvd status", "amount received status"],
    ["amount rcvd status", "amount received", "rcvd status"]
  );

  const normalizedRows = rows
    .map((row) => {
      const date = findRowDate(row);
      const amount = amountIndex >= 0 ? parseAmount(row[amountIndex]) : 0;
      const invoice = invoiceIndex >= 0 ? String(row[invoiceIndex] || "").trim() : "";
      const status = statusIndex >= 0 ? String(row[statusIndex] || "").trim().toLowerCase() : "";
      const client = clientIndex >= 0 ? String(row[clientIndex] || "").trim() : "";
      const project = projectIndex >= 0 ? String(row[projectIndex] || "").trim() : "";
      const amountReceived = amountReceivedIndex >= 0 ? String(row[amountReceivedIndex] || "").trim().toLowerCase() : "";
      const emirate = detectEmirate(project);
      const delivered = status.includes("deliver");
      const isReceived =
        amountReceived.includes("yes") ||
        amountReceived.includes("received") ||
        amountReceived.includes("done");

      return { row, date, amount, invoice, status, client, project, amountReceived, emirate, delivered, isReceived };
    })
    .filter((item) => item.date);

  const yearly = new Map();
  const clientTotals = new Map();
  const clientAmountTotals = new Map();
  const projectTotals = new Map();
  const emirateTotals = new Map();
  const emirateAmountTotals = new Map();
  const pendingJobs = [];
  const unpaidJobs = [];
  const yearlyClientLeaders = new Map();
  let invoiceCount = 0;
  let deliveredCount = 0;
  let pendingAmount = 0;
  let unpaidAmount = 0;
  let totalAmount = 0;

  for (const item of normalizedRows) {
    const year = item.date.getFullYear();
    const current = yearly.get(year) || {
      year,
      works: 0,
      invoices: 0,
      delivered: 0,
      pending: 0,
      unpaid: 0,
      amount: 0,
    };

    current.works += 1;
    current.amount += item.amount;
    totalAmount += item.amount;

    if (item.invoice) {
      current.invoices += 1;
      invoiceCount += 1;
    }

    if (item.delivered) {
      current.delivered += 1;
      deliveredCount += 1;
    } else {
      current.pending += item.amount;
      pendingAmount += item.amount;
      pendingJobs.push({
        client: item.client || "Unknown client",
        project: item.project || "Unknown project",
        amount: item.amount,
        year,
      });
    }

    if (!item.isReceived) {
      current.unpaid += item.amount;
      unpaidAmount += item.amount;
      unpaidJobs.push({
        client: item.client || "Unknown client",
        project: item.project || "Unknown project",
        amount: item.amount,
        status: item.amountReceived || "Pending",
        year,
      });
    }

    yearly.set(year, current);

    if (item.client) {
      clientTotals.set(item.client, (clientTotals.get(item.client) || 0) + 1);
      clientAmountTotals.set(item.client, (clientAmountTotals.get(item.client) || 0) + item.amount);

      const clientMap = yearlyClientLeaders.get(year) || new Map();
      clientMap.set(item.client, (clientMap.get(item.client) || 0) + 1);
      yearlyClientLeaders.set(year, clientMap);
    }

    if (item.project) {
      projectTotals.set(item.project, (projectTotals.get(item.project) || 0) + 1);
    }

    emirateTotals.set(item.emirate, (emirateTotals.get(item.emirate) || 0) + 1);
    emirateAmountTotals.set(item.emirate, (emirateAmountTotals.get(item.emirate) || 0) + item.amount);
  }

  const sortedYearsAsc = [...yearly.values()].sort((a, b) => a.year - b.year);
  const sortedYears = [...sortedYearsAsc].sort((a, b) => b.year - a.year);
  const firstYear = sortedYearsAsc[0]?.year || new Date().getFullYear();
  const latestYear = sortedYears[0]?.year || new Date().getFullYear();

  const monthly = monthNames.map((name) => ({
    month: name,
    works: 0,
    amount: 0,
    delivered: 0,
    unpaid: 0,
  }));

  for (const item of normalizedRows) {
    if (item.date.getFullYear() === latestYear) {
      const monthIndex = item.date.getMonth();
      monthly[monthIndex].works += 1;
      monthly[monthIndex].amount += item.amount;
      monthly[monthIndex].delivered += item.delivered ? 1 : 0;
      monthly[monthIndex].unpaid += item.isReceived ? 0 : item.amount;
    }
  }

  const yearlyGrowth = sortedYearsAsc.map((item, index) => {
    const previous = sortedYearsAsc[index - 1];
    const delta = previous ? item.works - previous.works : item.works;
    const leaderEntries = [...(yearlyClientLeaders.get(item.year) || new Map()).entries()].sort((a, b) => b[1] - a[1]);

    return {
      year: item.year,
      works: item.works,
      delta,
      topClient: leaderEntries[0]?.[0] || "Unknown",
    };
  });

  const topClients = [...clientTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count, amount: clientAmountTotals.get(name) || 0 }));

  const topProjects = [...projectTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));

  const topEmirates = [...emirateTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count, amount: emirateAmountTotals.get(name) || 0 }));

  return {
    totalWorks: normalizedRows.length,
    totalAmount,
    invoiceCount,
    deliveredCount,
    pendingAmount,
    unpaidAmount,
    firstYear,
    latestYear,
    strongestYear: sortedYearsAsc.reduce(
      (best, item) => (!best || item.works > best.works ? item : best),
      null
    ),
    strongestClient: topClients[0] || null,
    strongestEmirate: topEmirates[0] || null,
    yearly: sortedYears,
    yearlyGrowth,
    monthly,
    topClients,
    topProjects,
    topEmirates,
    pendingJobs: pendingJobs.sort((a, b) => b.amount - a.amount).slice(0, 8),
    unpaidJobs: unpaidJobs.sort((a, b) => b.amount - a.amount).slice(0, 8),
  };
}

async function handleSheetTest(req, res) {
  try {
    const values = await fetchSheetValues();

    res.json({
      success: true,
      values,
    });
  } catch (error) {
    console.error("Google Sheets request failed", {
      message: error.message,
      code: error.code || null,
      status: error.status || error.response?.status || null,
    });

    res.status(500).json({
      success: false,
      error: "Failed to read data from Google Sheet",
    });
  }
}

app.get("/api/dashboard-summary", async (req, res) => {
  try {
    const values = await fetchSheetValues();
    const summary = buildDashboardSummary(values);

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error("Dashboard summary request failed", {
      message: error.message,
      code: error.code || null,
      status: error.status || error.response?.status || null,
    });

    res.status(500).json({
      success: false,
      error: "Failed to build dashboard summary",
    });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ message: "Al Arsh backend is running" });
});

app.get("/api/sheet-test", handleSheetTest);
app.get("/sheet-test", handleSheetTest);

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
