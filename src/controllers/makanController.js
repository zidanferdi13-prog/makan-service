const { v4: uuidv4 } = require("uuid");
const { DBConf } = require("../config/database");
const axios = require("axios");
const { API_BASE_URL, API_ENDPOINTS } = require("../config/apiConfig");

module.exports = {
  makan: async function (req, res) {
    try {
      const request = DBConf.promise();
      const { rfid } = req.body;
      const uuid = uuidv4();

      // ================= TIME =================
      const now = new Date();
      const now_wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);

      const tanggal = now_wib.toISOString().split("T")[0];
      const jamScan = now_wib.toISOString().slice(0, 19).replace("T", " ");
      const jamOnly = jamScan.split(" ")[1];

      // ================= SHIFT =================
      const shift1_in = { mulai: "20:00:00", selesai: "23:59:59" };
      const shift1_out = { mulai: "00:00:00", selesai: "04:00:00" };
      const shift2_in = { mulai: "06:00:00", selesai: "11:00:00" };
      const shift2_out = { mulai: "11:30:00", selesai: "14:00:00" };
      const shift3_in = { mulai: "14:30:00", selesai: "16:00:00" };
      const shift3_out = { mulai: "17:00:00", selesai: "19:30:00" };

      const inRange = (jam, r) => jam >= r.mulai && jam <= r.selesai;

      function getShift(jam) {
        if (inRange(jam, shift1_in) || inRange(jam, shift1_out)) return 1;
        if (inRange(jam, shift2_in) || inRange(jam, shift2_out)) return 2;
        if (inRange(jam, shift3_in) || inRange(jam, shift3_out)) return 3;
        return null;
      }

      const shift = getShift(jamOnly);
      if (!shift) return res.json({ message: "Diluar jam makan" });

      const isIn =
        inRange(jamOnly, shift1_in) ||
        inRange(jamOnly, shift2_in) ||
        inRange(jamOnly, shift3_in);

      const isOut =
        inRange(jamOnly, shift1_out) ||
        inRange(jamOnly, shift2_out) ||
        inRange(jamOnly, shift3_out);

      // ================= KARYAWAN =================
      const [kRows] = await request.query(
        `SELECT m_karyawan_id, nama 
                    FROM m_karyawan 
                    WHERE rfid=? AND isactive=1`,
        [rfid]
      );

      if (!kRows.length) return res.json({ message: "RFID tidak ditemukan" });
      const karyawan = kRows[0];

      // ================= BUSINESS DATE =================
      let business_date = tanggal;
      let tanggalInsert = tanggal;

      if (shift === 1 && isIn) {
        // shift1 daftar
        let besok = new Date(tanggal);
        besok.setDate(besok.getDate() + 1);
        business_date = besok.toISOString().split("T")[0];
      }

      if (shift === 1 && isOut) {
        business_date = tanggal;

        // jika belum ada row → tanggal produksi kemarin
        let kemarin = new Date(tanggal);
        kemarin.setDate(kemarin.getDate() - 1);
        tanggalInsert = kemarin.toISOString().split("T")[0];
      }

      // ================= UPSERT LOGIC =================
      // pakai unique index → anti double
      const [rows] = await request.query(
        `SELECT * FROM m_makan_karyawan
                    WHERE m_karyawan_id=? 
                    AND shift=? 
                    AND business_date=?`,
        [karyawan.m_karyawan_id, shift, business_date]
      );

      // ================= UPDATE =================
      if (rows.length > 0) {
        const row = rows[0];

        // IN
        if (isIn && row.ismakan !== 1) {
          await request.query(
            `UPDATE m_makan_karyawan 
                            SET ismakan=1, waktu_pesan=? 
                            WHERE m_makan_karyawan_id=?`,
            [jamOnly, row.m_makan_karyawan_id]
          );

          return res.json({ message: "Daftar makan", nama: karyawan.nama });
        }

        // OUT
        if (isOut && row.actual_makan !== 1) {
          await request.query(
            `UPDATE m_makan_karyawan 
                            SET actual_makan=1, waktu_makan=? 
                            WHERE m_makan_karyawan_id=?`,
            [jamOnly, row.m_makan_karyawan_id]
          );

          return res.json({ message: "Makan diambil", nama: karyawan.nama });
        }

        return res.json({ message: "Sudah tercatat", nama: karyawan.nama });
      }

      // ================= INSERT =================
      const ismakan = isIn ? 1 : 0;
      const actual = isOut ? 1 : 0;
      const waktuPesan = isIn ? jamOnly : null;
      const waktuMakan = isOut ? jamOnly : null;

      await request.query(
        `INSERT INTO m_makan_karyawan
                    (m_makan_karyawan_id, m_karyawan_id, tanggal, nama,
                        ismakan, actual_makan, shift, createdate,
                        waktu_pesan, waktu_makan, business_date)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          uuid,
          karyawan.m_karyawan_id,
          tanggalInsert,
          karyawan.nama,
          ismakan,
          actual,
          shift,
          jamScan,
          waktuPesan,
          waktuMakan,
          business_date,
        ]
      );

      return res.json({
        message: actual ? "Makan diambil" : "Daftar makan",
        nama: karyawan.nama,
        shift,
      });

    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Server error", err });
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

