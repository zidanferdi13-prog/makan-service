const express = require("express");
require("dotenv").config();
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");
const { makan, findMakan } = require("./src/controllers/makanController");
const { sinkronData } = require("./src/controllers/syncData");
const { startSync, getDataDevice, getDataCloud } = require("./src/controllers/syncCloud");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.use(bodyParser.json({ limit: "100mb" }));
app.use(
  bodyParser.urlencoded({
    limit: "100mb",
    extended: true,
    parameterLimit: 1000000,
  })
);

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/makan", makan);
app.post("/findMakan", findMakan);

// Route untuk trigger manual sync
app.post("/sync", async (req, res) => {
  try {
    const result = await sinkronData();
    res.json({
      success: true,
      message: `Sinkronisasi selesai: ${result.inserted} inserted, ${result.updated} updated dari ${result.total} data`,
      total: result.total,
      inserted: result.inserted,
      updated: result.updated,
      deleted: result.deleted,
      errors: result.errors
    });
  } catch (error) {
    console.error("Error sync manual:", error);
    res.status(500).json({ success: false, message: "Gagal sinkronisasi: " + error.message });
  }
});

// Route untuk sync cloud (push data ke cloud)
app.post("/getDataDevice", async (req, res) => {
  try {
    const result = await getDataDevice();
    res.json({
      success: result.success,
      message: result.message,
      total: result.total
    });
  } catch (error) {
    console.error("Error sync cloud:", error);
    res.status(500).json({ success: false, message: "Gagal sinkronisasi cloud: " + error.message });
  }
});

app.post("/getDataCloud", async (req, res) => {
  try {
    const result = await getDataCloud();
    res.json({
      success: result.success,
      message: result.message,
      total: result.total
    });
  } catch (error) {
    console.error("Error sync cloud:", error);
    res.status(500).json({ success: false, message: "Gagal sinkronisasi cloud: " + error.message });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
  console.log(`Sinkronisasi data akan berjalan setiap 10 menit`);
  
  // Mulai sinkronisasi otomatis
  startSync();
});
