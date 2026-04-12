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

async function handleSheetTest(req, res) {
  try {
    const { GOOGLE_SHEET_ID } = process.env;

    if (hasPlaceholder(GOOGLE_SHEET_ID)) {
      return res.status(500).json({
        success: false,
        error: "Missing required Google Sheets configuration",
      });
    }

    const { auth, sheets } = getSheetsClient();
    await auth.authorize();

    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: GOOGLE_SHEET_ID,
      range: "Sheet1",
    });

    res.json({
      success: true,
      range: response.data.range,
      values: response.data.values || [],
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
