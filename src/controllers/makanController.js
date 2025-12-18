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
      // let tanggal = "2025-12-18";

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

      // let jamScan = "2025-12-18 12:30:00";
      // let jamOnly = "12:30:00";

      console.log("[SCAN] Jam Scan (Full):", jamScan);
      console.log("[SCAN] Jam Scan (Time only):", jamOnly);

      let ismakan = null;
      let actMkn = null;
      let WaktuShift = null;
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

      //ambil data karyawan dari rfid
      let ambilData = await request.query(
        `select m_karyawan_id, nama from m_karyawan where rfid = ?`,
        [rfid]
      );
      if (ambilData[0].length == 0) {
        console.log("[ERROR] RFID tidak ditemukan di database");
        return res.json({ message: "RFID tidak ditemukan" });
      }

      let data = ambilData[0][0];
      console.log("[DB] Data Karyawan Ditemukan:", { id: data.m_karyawan_id, nama: data.nama });

      //cek apakah sebelumnya sudah scan atau belum
      let cekMakan = await request.query(
        `select * from m_makan_karyawan where m_karyawan_id = ? and tanggal =?`,
        [data.m_karyawan_id, tanggal]
      );

      console.log("[DB] Cek Data Makan Existing:", cekMakan[0].length > 0 ? "Sudah Ada" : "Tidak Ada");

      if (cekMakan[0].length > 0) {
        //kalau sudah scan makan, update ismakan = 1
        let existingData = cekMakan[0][0];
        ismakan = existingData.ismakan;
        actMkn = existingData.actual_makan;

        console.log("[UPDATE] Data Existing - ismakan:", ismakan, "actual_makan:", actMkn);

        if (
          isWaktuMakan(jamOnly, shift1_in) || isWaktuMakan(jamOnly, shift2_in) || isWaktuMakan(jamOnly, shift3_in)  
        ) {
          ismakan = 1;
          waktuPesan = jamOnly;
          isWaktuShift(jamOnly);
          console.log("[LOGIC] Waktu Makan Shift In Terdeteksi - Shift:", WaktuShift);
          await request.query(
            `update m_makan_karyawan set ismakan=?, shift=?, waktu_pesan=? where m_karyawan_id=? and tanggal =?`,
            [ismakan, WaktuShift, waktuPesan, data.m_karyawan_id, tanggal]
          );
          console.log("[DB] Update Berhasil - ismakan=1, shift=", WaktuShift);
        } else if (
          isWaktuMakan(jamOnly, shift1_out) || isWaktuMakan(jamOnly, shift2_out) || isWaktuMakan(jamOnly, shift3_out)  
        ) {
          actMkn = 1;
          waktuMakan = jamOnly;
          isWaktuShift(jamOnly);
          console.log("[LOGIC] Waktu Makan Shift Out Terdeteksi - Shift:", WaktuShift);
          await request.query(
            `update m_makan_karyawan set actual_makan=?, shift=?, waktu_makan=? where m_karyawan_id=? and tanggal =?`,
            [actMkn, WaktuShift, waktuMakan, data.m_karyawan_id, tanggal]
          );
          console.log("[DB] Update Berhasil - actual_makan=1, shift=", WaktuShift);
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
            waktuShift: WaktuShift,
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
          isWaktuShift(jamOnly);
          waktuPesan = jamOnly;
          console.log("[LOGIC] Shift In Terdeteksi - Shift:", WaktuShift);

          // Penanganan khusus untuk Shift 1 Night Shift
          if (isWaktuMakan(jamOnly, shift1_in)) {
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
          isWaktuShift(jamOnly);
          console.log("[LOGIC] Shift Out Terdeteksi - Shift:", WaktuShift);
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
          WaktuShift,
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
            waktuShift: WaktuShift,
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

