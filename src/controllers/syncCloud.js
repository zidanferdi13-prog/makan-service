const axios = require("axios");
const { DBConf } = require("../config/database");
const { API_BASE_URL, API_ENDPOINTS } = require("../config/apiConfig");

const sinkronCloud = async () => {
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

    const apiUrl = `${API_BASE_URL}${API_ENDPOINTS.SINKRON_CLOUD}`;
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
      `[${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}] Sinkronisasi cloud berhasil - ` +
      `Total: ${rows.length} data terkirim`
    );

    return { 
      success: true, 
      message: `Berhasil mengirim ${rows.length} data ke cloud`, 
      total: rows.length,
      response: response.data
    };
  } catch (error) {
    console.error(`[${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}] Error sinkronisasi cloud:`, error.message);
    throw error;
  }
};

// Jalankan sinkronisasi setiap 10 menit (600000 ms)
const startSync = () => {
  setInterval(sinkronCloud, 15 * 60 * 1000);
  
  // Jalankan sinkronisasi pertama kali saat start
  sinkronCloud();
};

module.exports = { startSync, sinkronCloud };
