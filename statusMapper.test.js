function normalizeMessage(message) {
  return String(message || "").trim().replace(/[.]+$/, "");
}

function getStatusText(message) {
  const normalizedMessage = normalizeMessage(message);
  let statusText = normalizedMessage || "-";
  if (normalizedMessage === "Makan diambil") {
    statusText = "Silahkan Makan";
  } else if (normalizedMessage === "Anda Belum Daftar Makan") {
    statusText = "Anda Belum Daftar Makan";
  } else if (normalizedMessage === "Daftar makan") {
    statusText = "Anda Terdaftar Makan";
  } else if (normalizedMessage === "Sudah tercatat") {
    statusText = "Sudah Tercatat";
  }
  return statusText;
}

const cases = [
  ["Anda Belum Daftar Makan.", "Anda Belum Daftar Makan"],
  ["Diluar jam makan", "Diluar jam makan"],
  ["Makan diambil", "Silahkan Makan"],
];

for (const [message, expected] of cases) {
  const actual = getStatusText(message);
  if (actual !== expected) {
    console.error(`For ${JSON.stringify(message)} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

console.log("status mapper handles backend messages");
