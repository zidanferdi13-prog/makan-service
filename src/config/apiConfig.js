require('dotenv').config();

module.exports = {
  API_BASE_URL: process.env.API_BASE_URL || "http://localhost:8002",
  API_ENDPOINTS: {
    SINKRON_DATA: "/employee/sinkronData",
    SINKRON_CLOUD: "/employee/sinkronCloud",
    SAVE_MAKAN: "/employee/saveMakanFromRaspi"
  }
};
