const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = 3000;

// Agar bisa membaca JSON
app.use(express.json());

// Agar file HTML/CSS/JS bisa dibuka
app.use(express.static(__dirname));

/*
==================================================
 API HARGA CPO
==================================================
*/
app.get("/api/cpo", async (req, res) => {
  try {
    const apiKey = process.env.COMMODITIES_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "COMMODITIES_API_KEY belum dipasang di file .env",
      });
    }

    const url =
      `https://www.commodities-api.com/api/latest` +
      `?access_key=${apiKey}` +
      `&base=USD` +
      `&symbols=CPO`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();

      console.error("COMMODITIES API ERROR:", errorText);

      return res.status(response.status).json({
        success: false,
        error: `API error: ${response.status}`,
        detail: errorText,
      });
    }

    const data = await response.json();

    if (!data.success) {
      return res.status(502).json({
        success: false,
        error: data.error || "Gagal mengambil harga CPO",
      });
    }

    res.json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error("ERROR CPO:", error);

    res.status(500).json({
      success: false,
      error: "Terjadi kesalahan pada server",
      detail: error.message,
    });
  }
});

/*
==================================================
 HALAMAN UTAMA
==================================================
*/
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/*
==================================================
 HALAMAN CPO
==================================================
*/
app.get("/cpo.html", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "cpo.html"));
});

/*
==================================================
 START SERVER
==================================================
*/
app.listen(PORT, () => {
  console.log("====================================");
  console.log("  PT BETAMI SERVER");
  console.log("====================================");
  console.log(`  Website : http://localhost:${PORT}`);
  console.log(`  CPO API : http://localhost:${PORT}/api/cpo`);
  console.log("====================================");
});
