const { v4: uuidv4 } = require("uuid");
const { DBConf } = require("../config/database");
const { API_BASE_URL, API_ENDPOINTS } = require("../config/apiConfig");

module.exports = {
    makanNew: async function (req, res) {
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

    makan: async function (req, res) {
    try {
      const request = DBConf.promise();
      let { rfid } = req.body;
      let uuid = uuidv4();

      let now = new Date();
      let now_wib = new Date(now.getTime() + (7 * 60 * 60 * 1000));
      // let tanggal = now_wib.toISOString().split("T")[0];
      let tanggal = "2026-02-26"; // for testing purpose

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

      // let jamScan = now_wib.toISOString().slice(0, 19).replace('T', ' ');
      // let jamOnly = jamScan.split(' ')[1]; // Ambil bagian waktu saja untuk pengecekan shift

      let jamScan = "2026-02-26 03:40:00";
      let jamOnly = "03:40:00";

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
        console.log("[DB] Data Makan untuk Shift Ini Sudah Ada - Akan Memproses Update");
        // return;
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
            return res.json({
              message: `Update Berhasil`,
              data: {
                nama: data.nama,
                jamScan: jamScan,
              },
            });
          }
          // OUT
        } else if (isWaktuMakan(jamOnly, shift1_out) || isWaktuMakan(jamOnly, shift2_out) || isWaktuMakan(jamOnly, shift3_out)) {
          if (actMkn === 1) {
            console.log("[ERROR] Makan Sudah Dikonfirmasi Sebelumnya - actual_makan=1");
          } else {
            if (waktuShift === 1) {
              console.log("[UPDATE] Konfirmasi Makan - Mengubah actual_makan dari 0 ke 1");
              actMkn = 1;
              waktuMakan = jamOnly;
              await request.query(
                `UPDATE m_makan_karyawan SET actual_makan=?, waktu_makan=? WHERE m_karyawan_id=? AND business_date =? AND shift=?`,
                [actMkn, waktuMakan, data.m_karyawan_id, tanggal, waktuShift]
              );
              console.log("[DB] Update Berhasil - actual_makan=1, shift=", waktuShift);
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

        console.log(waktuShift === 1 ? "[LOGIC] Shift 1 Detected - Akan Menambahkan Business Date Besok" : "[LOGIC] Shift 2/3 Detected - Business Date Sama dengan Tanggal Scan");

        if (waktuShift === 1) {
          let tanggalBesok = new Date(tanggal);
          tanggalBesok.setDate(tanggalBesok.getDate() + 1);
          let tanggalBesokStr = null;

          console.log(actMkn === 1 ? "[LOGIC] Shift 1 OUT Detected - Tidak Perlu Isi Business Date karena sudah actual makan di shift 1" : "[LOGIC] Shift 1 IN Detected - Akan Menambahkan Business Date Besok");

          if (actMkn === 1) {
            console.log("Tidak perlu isi business date karena sudah actual makan di shift 1");
            tanggalBesokStr = null;

          } else {

            tanggalBesokStr = tanggalBesok.toISOString().split("T")[0];

            console.log("[LOGIC] Shift 1 Detected - Business Date Besok:", tanggalBesokStr);

          }

          // return

          let queryInsert = `
              INSERT INTO m_makan_karyawan (
              m_makan_karyawan_id, 
              m_karyawan_id, 
              tanggal, 
              nama, 
              ismakan, 
              actual_makan, 
              shift, 
              createdate, 
              waktu_pesan, 
              waktu_makan,
              business_date
              ) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            waktuMakan,
            tanggalBesokStr
          ];
          await request.query(queryInsert, insertdata);
          console.log("[DB] Insert Berhasil - UUID:", uuid);
        } else {

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

        }

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
};
