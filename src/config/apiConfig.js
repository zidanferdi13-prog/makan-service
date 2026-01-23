require('dotenv').config();

module.exports = {
  API_BASE_URL: process.env.API_BASE_URL || "http://services.ama.id:8002",
  // API_BASE_URL: process.env.API_BASE_URL || "http://localhost:8002",
  API_ENDPOINTS: {
    SINKRON_DATA: "/employee/sinkronData",
    GET_DATA_DEVICE: "/employee/getDataDevice",
    GET_DATA_CLOUD: "/employee/getDataCloud",
    SAVE_MAKAN: "/employee/saveMakanFromRaspi"
  }
};
