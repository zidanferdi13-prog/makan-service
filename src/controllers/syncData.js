const axios = require("axios");
const { DBConf } = require("../config/database");
const { API_BASE_URL, API_ENDPOINTS } = require("../config/apiConfig");

const sinkronData = async () => {
  try {
    const response = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.SINKRON_DATA}`);
    const { status, message, total, data } = response.data;

    if (status === "200" && data && data.length > 0) {
      const connection = await DBConf.promise();

      let updated = 0;
      let inserted = 0;
      let errors = 0;
      let deleted = 0;

      for (const karyawan of data) {
        try {
          // Cek apakah karyawan sudah ada di database
          const [existing] = await connection.query(
            `SELECT * FROM m_karyawan WHERE m_karyawan_id = ?`,
            [karyawan.m_karyawan_id]
          );

          if (existing.length > 0) {
            // Update data yang sudah ada
            await connection.query(
              `UPDATE m_karyawan SET 
                nama = ?, 
                m_department_id = ?, 
                nomor_tlp = ?, 
                alamat = ?, 
                isactive = ?, 
                jenis_kelamin = ?, 
                NIK = ?, 
                company = ?, 
                m_jabatan_id = ?, 
                pwd = ?, 
                tgl_join = ?, 
                status_karyawan = ?, 
                cuti = ?, 
                status = ?, 
                email = ?, 
                tgl_lahir = ?, 
                tempat_lahir = ?, 
                adm_covid = ?, 
                created = ?, 
                cuti_khusus = ?, 
                cuti_besar = ?, 
                token = ?, 
                teamLeader = ?, 
                inital = ?, 
                inisial = ?, 
                is_sales = ?, 
                segment = ?, 
                allow_absent = ?, 
                img = ?, 
                kode_template = ?, 
                is_pic_area = ?, 
                rfid = ?
              WHERE m_karyawan_id = ?`,
              [
                karyawan.nama,
                karyawan.m_department_id,
                karyawan.nomor_tlp,
                karyawan.alamat,
                karyawan.isactive,
                karyawan.jenis_kelamin,
                karyawan.NIK,
                karyawan.company,
                karyawan.m_jabatan_id,
                karyawan.pwd,
                karyawan.tgl_join,
                karyawan.status_karyawan,
                karyawan.cuti,
                karyawan.status,
                karyawan.email,
                karyawan.tgl_lahir,
                karyawan.tempat_lahir,
                karyawan.adm_covid,
                karyawan.created,
                karyawan.cuti_khusus,
                karyawan.cuti_besar,
                karyawan.token,
                karyawan.teamLeader,
                karyawan.inital,
                karyawan.inisial,
                karyawan.is_sales,
                karyawan.segment,
                karyawan.allow_absent,
                karyawan.img,
                karyawan.kode_template,
                karyawan.is_pic_area,
                karyawan.rfid,
                karyawan.m_karyawan_id
              ]
            );
            updated++;
          } else {
            // Insert data baru
            await connection.query(
              `INSERT INTO m_karyawan (
                m_karyawan_id, nama, m_department_id, nomor_tlp, alamat, isactive, 
                jenis_kelamin, NIK, company, m_jabatan_id, pwd, tgl_join, 
                status_karyawan, cuti, status, email, tgl_lahir, tempat_lahir, 
                adm_covid, created, cuti_khusus, cuti_besar, token, teamLeader, 
                inital, inisial, is_sales, segment, allow_absent, img, 
                kode_template, is_pic_area, rfid
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                karyawan.m_karyawan_id,
                karyawan.nama,
                karyawan.m_department_id,
                karyawan.nomor_tlp,
                karyawan.alamat,
                karyawan.isactive,
                karyawan.jenis_kelamin,
                karyawan.NIK,
                karyawan.company,
                karyawan.m_jabatan_id,
                karyawan.pwd,
                karyawan.tgl_join,
                karyawan.status_karyawan,
                karyawan.cuti,
                karyawan.status,
                karyawan.email,
                karyawan.tgl_lahir,
                karyawan.tempat_lahir,
                karyawan.adm_covid,
                karyawan.created,
                karyawan.cuti_khusus,
                karyawan.cuti_besar,
                karyawan.token,
                karyawan.teamLeader,
                karyawan.inital,
                karyawan.inisial,
                karyawan.is_sales,
                karyawan.segment,
                karyawan.allow_absent,
                karyawan.img,
                karyawan.kode_template,
                karyawan.is_pic_area,
                karyawan.rfid
              ]
            );
            inserted++;
          }
        } catch (err) {
          errors++;
          console.error(`Error processing karyawan ${karyawan.nama}:`, err.message);
        }
      }

      const apiIds = data.map(k => k.m_karyawan_id);
      const [localRows] = await connection.query('SELECT m_karyawan_id FROM m_karyawan');
      const localIds = localRows.map(row => row.m_karyawan_id);
      const idsToDelete = localIds.filter(id => !apiIds.includes(id));
      if (idsToDelete.length > 0) {
        await connection.query(
          `DELETE FROM m_karyawan WHERE m_karyawan_id IN (${idsToDelete.map(() => '?').join(',')})`,
          idsToDelete
        );
        deleted = idsToDelete.length;
      }

      const result = {
        total,
        inserted,
        updated,
        deleted,
        errors
      };

      console.log(
        `[${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}] Sinkronisasi selesai - ` +
        `Total: ${total}, Inserted: ${inserted}, Updated: ${updated}, Deleted: ${deleted}, Errors: ${errors}`
      );

      return result;
    } else {
      console.log(`[${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}] Tidak ada data untuk disinkronkan`);
      return { total: 0, inserted: 0, updated: 0, errors: 0, deleted: 0 };
    }
  } catch (error) {
    console.error(`[${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}] Error sinkronisasi data:`, error.message);
    throw error;
  }
};

// Jalankan sinkronisasi setiap 10 menit (600000 ms)
// const startSync = () => {
//   setInterval(sinkronData, 10 * 60 * 1000);
  
//   // Jalankan sinkronisasi pertama kali saat start
//   sinkronData();
// };

module.exports = { /*startSync,*/ sinkronData };
