const axios = require("axios");
const { DBConf } = require("../config/database");
const { API_BASE_URL, API_ENDPOINTS } = require("../config/apiConfig");

const getDataDevice = async () => {
  try {
    const connection = await DBConf.promise();

    // Ambil semua data dari m_makan_karyawan
    const [rows] = await connection.query(
      'SELECT m_makan_karyawan_id, DATE_FORMAT(createdate, \'%Y-%m-%d %H:%i:%s\') AS createdate, nama, tanggal, ismakan, m_karyawan_id, actual_makan, shift, waktu_pesan, waktu_makan, DATE_FORMAT(business_date, \'%Y-%m-%d\') AS business_date \
      FROM m_makan_karyawan WHERE tanggal = CURDATE() ORDER BY createdate DESC'
    );

    console.log(`[DEBUG] Jumlah data yang akan dikirim: ${rows.length}`);
    // console.log(`[DEBUG] Data sample:`, rows); // Tampilkan 2 data pertama sebagai sampel
    // return

    if (rows.length === 0) {
      console.log(`[${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}] Tidak ada data untuk disinkronkan ke cloud`);
      return { success: false, message: "Tidak ada data untuk disinkronkan", total: 0 };
    }

    const apiUrl = `${API_BASE_URL}${API_ENDPOINTS.GET_DATA_DEVICE}`;
    console.log(`[DEBUG] Mengirim ke URL: ${apiUrl}`);
    console.log(`[DEBUG] Jumlah data:`, rows.length);

    // Kirim data ke API cloud
    const response = await axios.post(apiUrl, rows, {
      headers: {
        'Content-Type': 'application/json'
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    console.log(
      `[${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}] Get Data Device berhasil - ` +
      `Total: ${rows.length} data terkirim`
    );

    return {
      success: true,
      message: `Berhasil mengirim ${rows.length} data ke cloud`,
      total: rows.length,
      response: response.data
    };
  } catch (error) {
    console.error(`[${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}] Error getDataDevice:`, error.message);
    throw error;
  }
};

getDataCloud = async () => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}${API_ENDPOINTS.GET_DATA_CLOUD}`
    );

    const { status, total, data } = response.data;

    if (status !== "200" || !data || data.length === 0) {
      console.log("Tidak ada data cloud");
      return;
    }

    const connection = await DBConf.promise();

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    // ===== normalize business_date =====
    function normalizeBusinessDate(dateStr) {
      if (!dateStr) return null;

      const d = new Date(dateStr);

      // convert ke WIB (+7)
      const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);

      return wib.toISOString().slice(0, 10);
    }

    for (const item of data) {
      try {
        const {
          m_makan_karyawan_id,
          m_karyawan_id,
          tanggal,
          nama,
          ismakan,
          actual_makan,
          createdate,
          shift,
          waktu_pesan,
          waktu_makan,
          business_date,
        } = item;

        const businessDateNormalized = normalizeBusinessDate(business_date);

        // ================= CEK DULU =================
        const [existing] = await connection.query(
          `SELECT m_makan_karyawan_id 
           FROM m_makan_karyawan 
           WHERE m_makan_karyawan_id = ?`,
          [m_makan_karyawan_id]
        );

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        // ================= INSERT =================
        await connection.query(
          `INSERT INTO m_makan_karyawan
           (m_makan_karyawan_id, m_karyawan_id, tanggal, nama,
            ismakan, actual_makan, createdate, shift,
            waktu_pesan, waktu_makan, business_date)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [
            m_makan_karyawan_id,
            m_karyawan_id,
            tanggal,
            nama,
            ismakan,
            actual_makan,
            createdate,
            shift,
            waktu_pesan,
            waktu_makan || null,
            businessDateNormalized,
          ]
        );

        inserted++;
      } catch (err) {
        console.error(
          "Error item:",
          item.m_makan_karyawan_id,
          err.message
        );
        errors++;
      }
    }

    console.log(
      `[SYNC CLOUD] Total:${total} Inserted:${inserted} Skipped:${skipped} Errors:${errors}`
    );

    return {
      success: true,
      total,
      inserted,
      skipped,
      errors,
    };
  } catch (error) {
    console.error("Error getDataCloud:", error.message);
  }
};

// Jalankan sinkronisasi setiap 10 menit (600000 ms)
const startSync = () => {
  setInterval(getDataCloud, 10 * 60 * 1000);
  setInterval(getDataDevice, 10 * 60 * 1000);

  // Jalankan sinkronisasi pertama kali saat start
  getDataCloud();
  getDataDevice();
};

module.exports = { startSync, getDataDevice, getDataCloud };
