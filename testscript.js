const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: '192.168.5.68',
    user: 'ama',
    password: 'ama1234!',
    database: 'info_mortindo'
  });

  // Query kamu
  const [rows] = await conn.execute(
    `SELECT * FROM m_makan_karyawan 
     WHERE tanggal = CURDATE() 
     ORDER BY createdate DESC`
  );

  // Convert ke JSON string
  const jsonString = JSON.stringify(rows);

  // Hitung ukuran JSON
  const sizeBytes = Buffer.byteLength(jsonString, 'utf8');
  const sizeKB = (sizeBytes / 1024).toFixed(2);

  console.log("Jumlah row:", rows.length);
  console.log("Size JSON:", sizeBytes, "bytes");
  console.log("Size JSON:", sizeKB, "KB");

  await conn.end();
}

run();
