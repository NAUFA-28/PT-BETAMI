const express = require("express");
const cors = require("cors");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const BAPPEBTI_URL = "https://bappebti.go.id/harga_komoditi_bursa/show";

const DATA_FILE = path.join(__dirname, "cpo-history.json");

/* =========================================================
   HISTORY
========================================================= */

function loadHistory() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return [];
    }

    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    console.error("Gagal membaca history:", error);

    return [];
  }
}

function saveHistory(history) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(history, null, 2), "utf8");
}

/* =========================================================
   AMBIL DATA CPO
========================================================= */

async function getBappebtiCPO() {
  const response = await fetch(BAPPEBTI_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 PT-BETAMI-CPO",
    },
  });

  if (!response.ok) {
    throw new Error(`BAPPEBTI HTTP ${response.status}`);
  }

  const html = await response.text();

  const $ = cheerio.load(html);

  let result = null;

  $("table tr").each((index, element) => {
    const cells = $(element)
      .find("td")
      .map((i, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get();

    if (cells.length < 4) {
      return;
    }

    const rowText = cells.join(" ").toUpperCase();

    if (
      rowText.includes("SPOT") &&
      rowText.includes("MEDAN") &&
      rowText.includes("RP/KG")
    ) {
      const priceText = cells.find((value) =>
        /^\d{1,3}(?:\.\d{3})*(?:,\d+)?$/.test(value),
      );

      if (priceText) {
        const normalized = priceText.replace(/\./g, "").replace(",", ".");

        const price = Number(normalized);

        if (Number.isFinite(price) && price > 0) {
          result = {
            price,

            unit: "IDR/kg",

            market: "SPOT Medan",
          };
        }
      }
    }
  });

  if (!result) {
    throw new Error("Data CPO SPOT Medan tidak ditemukan.");
  }

  const pageText = $("body").text().replace(/\s+/g, " ").trim();

  const dateMatch = pageText.match(
    /TANGGAL\s*:\s*<?\s*(\d{1,2}\s+\w+\s+\d{4})/i,
  );

  result.date = dateMatch
    ? dateMatch[1]
    : new Date().toLocaleDateString("id-ID");

  result.source = "BAPPEBTI / ICDX";

  result.sourceUrl = BAPPEBTI_URL;

  return result;
}

/* =========================================================
   UPDATE HISTORY
========================================================= */

async function updateHistory() {
  const current = await getBappebtiCPO();

  let history = loadHistory();

  const exists = history.some(
    (item) => item.date === current.date && item.price === current.price,
  );

  if (!exists) {
    history.push({
      date: current.date,

      price: current.price,
    });

    history = history.slice(-30);

    saveHistory(history);
  }

  return {
    current,
    history,
  };
}

/* =========================================================
   API CPO
========================================================= */

app.get("/api/cpo", async (req, res) => {
  try {
    const data = await updateHistory();

    const current = data.current;

    const history = data.history;

    let previous = null;

    if (history.length >= 2) {
      previous = history[history.length - 2].price;
    }

    let change = null;

    if (previous !== null && previous > 0) {
      change = ((current.price - previous) / previous) * 100;
    }

    res.json({
      success: true,

      commodity: "CPO",

      price: current.price,

      previous: previous,

      change: change === null ? null : Number(change.toFixed(2)),

      currency: "Rp",

      unit: "kg",

      market: current.market,

      date: current.date,

      updatedAt: new Date().toISOString(),

      source: current.source,

      sourceUrl: current.sourceUrl,

      history: history,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,

      message: "Gagal mengambil data CPO.",

      error: error.message,
    });
  }
});

/* =========================================================
   TEST SERVER
========================================================= */

app.get("/", (req, res) => {
  res.json({
    status: "online",

    service: "PT BETAMI CPO API",

    endpoint: "/api/cpo",
  });
});

/* =========================================================
   START SERVER
========================================================= */

app.listen(PORT, () => {
  console.log("");
  console.log("================================");

  console.log(" PT BETAMI - CPO BACKEND");

  console.log("================================");

  console.log(`Server berjalan di:`);

  console.log(`http://localhost:${PORT}`);

  console.log("");

  console.log("API CPO:");

  console.log(`http://localhost:${PORT}/api/cpo`);

  console.log("");
});
