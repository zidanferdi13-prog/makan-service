const { v4: uuidv4 } = require("uuid");
const { DBConf } = require("../config/database");
const axios = require("axios");
const { API_BASE_URL, API_ENDPOINTS } = require("../config/apiConfig");

module.exports = {
  makan: async function (req, res) {
    try {
      const request = DBConf.promise();
      let { rfid } = req.body;
      let uuid = uuidv4();

      let now = new Date();
      let now_wib = new Date(now.getTime() + (7 * 60 * 60 * 1000));
      let tanggal = now_wib.toISOString().split("T")[0];
      // let tanggal = "2026-01-14"; // for testing purpose

      console.log("\n=== [MAKAN] PROSES SCAN DIMULAI ===");
      console.log("[INPUT] RFID:", rfid);
      console.log("[TIME] Waktu UTC:", now.toISOString());
      console.log("[TIME] Waktu WIB:", now_wib.toISOString());
      console.log("[DATE] Tanggal:", tanggal);

      const shift1_in = { mulai: "20:00:00", selesai: "23:59:00" };
      const shift1_out = { mulai: "03:00:00", selesai: "04:00:00" };

      const shift2_in = { mulai: "06:00:00", selesai: "11:00:00" };
      const shift2_out = { mulai: "11:30:00", selesai: "14:00:00" };

      const shift3_in = { mulai: "14:30:00", selesai: "16:00:00" };
      const shift3_out = { mulai: "17:00:00", selesai: "19:30:00" };

      let jamScan = now_wib.toISOString().slice(0, 19).replace('T', ' ');
      let jamOnly = jamScan.split(' ')[1]; // Ambil bagian waktu saja untuk pengecekan shift

      // let jamScan = "2026-01-14 10:40:00";
      // let jamOnly = "10:40:00";

      // console.log("[SCAN] Jam Scan (Full):", jamScan);
      // console.log("[SCAN] Jam Scan (Time only):", jamOnly);

      let ismakan = null;
      let actMkn = null;
      let waktuMakan = null;
      let waktuPesan = null;

      function isWaktuMakan(jam, shift) {
        return jam >= shift.mulai && jam <= shift.selesai;
      }

      function isWaktuShift(jamOnly) {
        if (isWaktuMakan(jamOnly, shift1_in) || isWaktuMakan(jamOnly, shift1_out)) {
          WaktuShift = 1;
          return WaktuShift;
        } else if (isWaktuMakan(jamOnly, shift2_in) || isWaktuMakan(jamOnly, shift2_out)) {
          WaktuShift = 2;
          return WaktuShift;
        } else if (isWaktuMakan(jamOnly, shift3_in) || isWaktuMakan(jamOnly, shift3_out)) {
          WaktuShift = 3;
          return WaktuShift;
        } else {
          return null;
        }
      }

      let waktuShift = isWaktuShift(jamOnly);
      if (!waktuShift) {
        console.log("[ERROR] Jam Scan Tidak Sesuai Dengan Waktu Shift Makan");
        return res.json({
          message: `Scan diluar jam`,
          data: {
            jamScan: jamScan,
          },
        });
      }

      //ambil data karyawan dari rfid
      let ambilData = await request.query(
        `SELECT m_karyawan_id, nama FROM m_karyawan WHERE rfid = ? and isactive = 1`,
        [rfid]
      );
      if (ambilData[0].length == 0) {
        console.log("[ERROR] RFID tidak ditemukan di database");
        return res.json({ message: "RFID tidak ditemukan" });
      }

      let data = ambilData[0][0];
      console.log("[DB] Data Karyawan Ditemukan:", { id: data.m_karyawan_id, nama: data.nama });

      // Cek semua data makan pada tanggal tsb untuk karyawan ini
      let cekMakanAll = await request.query(
        `SELECT * FROM m_makan_karyawan WHERE m_karyawan_id = ? AND tanggal = ?`,
        [data.m_karyawan_id, tanggal]
      );
      // Cek apakah sudah ada row untuk shift ini
      let existingShift = cekMakanAll[0].find(row => row.shift == waktuShift);
      if (existingShift) {
        ismakan = existingShift.ismakan;
        actMkn = existingShift.actual_makan;
        // IN
        if (isWaktuMakan(jamOnly, shift1_in) || isWaktuMakan(jamOnly, shift2_in) || isWaktuMakan(jamOnly, shift3_in)) {
          if (ismakan === 1) {
            console.log("[ERROR] Makan Sudah Dikonfirmasi Sebelumnya - ismakan=1");
            return res.json({
              message: `Makan sudah dikonfirmasi sebelumnya`,
              data: {
                nama: data.nama,
                jamScan: jamScan,
              },
            });
          } else {
            console.log("[UPDATE] Konfirmasi Makan - Mengubah ismakan dari 0 ke 1");
            ismakan = 1;
            waktuPesan = jamOnly;
            await request.query(
              `UPDATE m_makan_karyawan SET ismakan=?, waktu_pesan=? WHERE m_karyawan_id=? AND tanggal =? AND shift=?`,
              [ismakan, waktuPesan, data.m_karyawan_id, tanggal, waktuShift]
            );
            console.log("[DB] Update Berhasil - ismakan=1, shift=", waktuShift);
          }
        // OUT
        } else if (isWaktuMakan(jamOnly, shift1_out) || isWaktuMakan(jamOnly, shift2_out) || isWaktuMakan(jamOnly, shift3_out)) {
          if (actMkn === 1) {
            console.log("[ERROR] Makan Sudah Dikonfirmasi Sebelumnya - actual_makan=1");
            return res.json({
              message: `Makan sudah dikonfirmasi sebelumnya`,
              data: {
                nama: data.nama,
                jamScan: jamScan,
              },
            });
          } else {
            console.log("[UPDATE] Konfirmasi Makan - Mengubah actual_makan dari 0 ke 1");
            actMkn = 1;
            waktuMakan = jamOnly;
            await request.query(
              `UPDATE m_makan_karyawan SET actual_makan=?, waktu_makan=? WHERE m_karyawan_id=? AND tanggal =? AND shift=?`,
              [actMkn, waktuMakan, data.m_karyawan_id, tanggal, waktuShift]
            );
            console.log("[DB] Update Berhasil - actual_makan=1, shift=", waktuShift);
          }
        } else {
          console.log("[ERROR] Scan Diluar Jam Operasional - Jam:", jamOnly);
          return res.json({
            message: `Scan diluar jam`,
            data: {
              nama: data.nama,
              jamScan: jamScan,
            },
          });
        }
        //response data tampilkan nama dan ismakan
        const responseData = {
          message: `berhasil`,
          data: {
            m_karyawan_id: data.m_karyawan_id,
            nama: data.nama,
            tanggal: tanggal,
            ismakan: ismakan,
            actual_makan: actMkn,
            jamScan: jamScan,
            waktuShift: waktuShift,
          },
        };
        console.log("[RESPONSE] Update Berhasil:", responseData.data);
        console.log("=== [MAKAN] PROSES SELESAI ===\n");
        return res.json(responseData);
      } else {
        //belum scan konfirm makan
        console.log("[INSERT] Data Baru - Akan Membuat Record Baru");

        if (
          isWaktuMakan(jamOnly, shift1_in) || isWaktuMakan(jamOnly, shift2_in) || isWaktuMakan(jamOnly, shift3_in)
        ) {
          ismakan = 1;
          waktuPesan = jamOnly;
          console.log("[LOGIC] Shift In Terdeteksi - Shift:", waktuShift);

          // Penanganan khusus untuk Shift 1 Night Shift
          if (waktuShift === 1) { 
            console.log("[LOGIC] Shift 1 Night Shift Detected - Increment Tanggal +1");
            // Tambah 1 hari untuk tanggal (tanpa mengubah timezone)
            let tglDate = new Date(tanggal + 'T00:00:00');
            tglDate.setDate(tglDate.getDate() + 1);
            let year = tglDate.getFullYear();
            let month = String(tglDate.getMonth() + 1).padStart(2, '0');
            let day = String(tglDate.getDate()).padStart(2, '0');
            let tanggalBefore = tanggal;
            tanggal = `${year}-${month}-${day}`;
            console.log(`[LOGIC] Tanggal Berubah: ${tanggalBefore} → ${tanggal}`);
            
            // Tambah 1 hari untuk jamScan (waktu tetap sama, hanya tanggal yang berubah)
            let [tgl, waktu] = jamScan.split(' ');
            let jamDate = new Date(tgl + 'T00:00:00');
            jamDate.setDate(jamDate.getDate() + 1);
            let yearJam = jamDate.getFullYear();
            let monthJam = String(jamDate.getMonth() + 1).padStart(2, '0');
            let dayJam = String(jamDate.getDate()).padStart(2, '0');
            let jamScanBefore = jamScan;
            jamScan = `${yearJam}-${monthJam}-${dayJam} ${waktu}`;
            console.log(`[LOGIC] JamScan Berubah: ${jamScanBefore} → ${jamScan}`);
          }
        } else if (
          isWaktuMakan(jamOnly, shift1_out) || isWaktuMakan(jamOnly, shift2_out) || isWaktuMakan(jamOnly, shift3_out)
        ) {
          actMkn = 1;
          waktuMakan = jamOnly;
          console.log("[LOGIC] Shift Out Terdeteksi - Shift:", waktuShift);
        } else {
          console.log("[ERROR] Scan Diluar Jam Operasional - Jam:", jamOnly);
          return res.json({
            message: `Scan diluar jam`,
            data: {
              nama: data.nama,
              jamScan: jamScan,
            },
          });
        }

        let queryInsert = `
        insert into m_makan_karyawan (m_makan_karyawan_id, m_karyawan_id, tanggal, nama, ismakan, actual_makan, shift, createdate, waktu_pesan, waktu_makan) 
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        let insertdata = [
          uuid,
          data.m_karyawan_id,
          tanggal,
          data.nama,
          ismakan,
          actMkn,
          waktuShift,
          jamScan,
          waktuPesan,
          waktuMakan
        ];
        await request.query(queryInsert, insertdata);
        console.log("[DB] Insert Berhasil - UUID:", uuid);

        const responseData = {
          message: `berhasil`,
          data: {
            m_karyawan_id: data.m_karyawan_id,
            nama: data.nama,
            tanggal: tanggal,
            ismakan: ismakan,
            actual_makan: actMkn,
            jamScan: jamScan,
            waktuShift: waktuShift,
          },
        };

        console.log("[RESPONSE] Insert Berhasil:", responseData.data);
        console.log("=== [MAKAN] PROSES SELESAI ===\n");
        return res.json(responseData);
      }
    } catch (error) {
      console.log("[ERROR] Exception Caught:", error.message);
      console.log("=== [MAKAN] PROSES GAGAL ===\n");
      res.status(500).json({
        message: "Error! Gagal input data makan",
        data: error,
      });
    }
  },

  findMakan: async function (req, res) {
    try {
      const request = DBConf.promise();

      let { tanggal } = req.body;
      let mkn;

      if (!tanggal || tanggal === "") {
        let [rows] = await request.query(`select * from m_makan_karyawan`);
        mkn = rows;
      } else {
        let [rows] = await request.query(
          `select * from m_makan_karyawan WHERE tanggal = ?`,
          [tanggal]
        );
        mkn = rows;
      }

      return res.send(respone("200", mkn));
    } catch (error) {
      console.log("error", error);
      res.status(500).json({
        message: error,
      });
    }
  },
};

