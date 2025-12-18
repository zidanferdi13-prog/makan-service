const mysql = require("mysql2");
require('dotenv').config();

const conf = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
};

const DBConf = new mysql.createPool(conf);
module.exports = { DBConf }