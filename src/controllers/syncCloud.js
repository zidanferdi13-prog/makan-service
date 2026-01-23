const axios = require("axios");
const { DBConf } = require("../config/database");
const { API_BASE_URL, API_ENDPOINTS } = require("../config/apiConfig");

const getDataDevice = async () => {
  try {
    const connection = await DBConf.promise();

    // Ambil semua data dari m_makan_karyawan
    const [rows] = await connection.query(
      'SELECT m_makan_karyawan_id, DATE_FORMAT(createdate, \'%Y-%m-%d %H:%i:%s\') AS createdate, nama, tanggal, ismakan, m_karyawan_id, actual_makan, shift, waktu_pesan, waktu_makan \
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

const getDataCloud = async () => {
  try {
    const response = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.GET_DATA_CLOUD}`);
    const { status, message, total, data } = response.data;

    if (status === "200" && data && data.length > 0) {
      const connection = await DBConf.promise();

      let updated = 0;
      let inserted = 0;
      let skipped = 0;
      let errors = 0;

      for (let item of data) {
        try {
          const { m_makan_karyawan_id, m_karyawan_id, tanggal, nama, ismakan, actual_makan, createdate, shift, waktu_pesan, waktu_makan } = item;
          
          const [existingRows] = await connection.query(
            `SELECT * FROM m_makan_karyawan WHERE m_makan_karyawan_id = ?`,
            [m_makan_karyawan_id]
          );
          
          console.log(`[DEBUG] Processing item ID: ${m_makan_karyawan_id}, Existing rows: ${existingRows.length}`);
          // return
          if (existingRows.length > 0) {
            let existingData = existingRows[0];
            if (existingData.ismakan !== ismakan || existingData.actual_makan !== actual_makan ||
              existingData.nama !== nama || existingData.shift !== shift ||
              existingData.waktu_pesan !== waktu_pesan || existingData.waktu_makan !== waktu_makan) {
              await connection.query(
                `UPDATE m_makan_karyawan 
                 SET nama = ?, ismakan = ?, actual_makan = ?, shift = ?, waktu_pesan = ?, waktu_makan = ?
                 WHERE m_makan_karyawan_id = ?`,
                [nama, ismakan, actual_makan, shift, waktu_pesan || null, waktu_makan || null, m_makan_karyawan_id]
              );
              console.log("Data updated for ID:", m_makan_karyawan_id);
              updated++;
            } else {
              skipped++;
            }
          } else {
            // Insert data baru dengan ID yang sama dari Raspi
            await connection.query(
              `INSERT INTO m_makan_karyawan 
               (m_makan_karyawan_id, m_karyawan_id, tanggal, nama, ismakan, actual_makan, createdate, shift, waktu_pesan, waktu_makan) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [m_makan_karyawan_id, m_karyawan_id, tanggal, nama, ismakan, actual_makan, createdate, shift, waktu_pesan, waktu_makan || null]
            );
            inserted++;
          }
        } catch (err) {
          console.error("Error processing item ID:", item.m_makan_karyawan_id, "Error:", err.message);
          errors++;
        }
      } // end for

      console.log(
        `[${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}] Get Data Cloud berhasil - ` +
        `Total: ${total}, Inserted: ${inserted}, Updated: ${updated}, Errors: ${errors}`
      );
      return {
        success: true,
        message: `Berhasil sinkronisasi data dari cloud`,
        total,
        inserted,
        updated,
        errors
      };
    } else {
      console.log(`[${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}] Tidak ada data dari cloud untuk disinkronkan`);
      return { success: false, message: "Tidak ada data dari cloud untuk disinkronkan", total: 0 };
    }
  } catch (error) {
    console.error(`[${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}] Error getDataCloud:`, error.message);
    throw error;
  }
};

// Jalankan sinkronisasi setiap 10 menit (600000 ms)
const startSync = () => {
  setInterval(getDataCloud, 15 * 60 * 1000);
  setInterval(getDataDevice, 15 * 60 * 1000);

  // Jalankan sinkronisasi pertama kali saat start
  getDataCloud();
  getDataDevice();
};

module.exports = { startSync, getDataDevice, getDataCloud };
