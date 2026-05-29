const util = require('util');

function nowISO() {
  return new Date().toISOString();
}

function safeStringify(obj) {
  try {
    return typeof obj === 'string' ? obj : JSON.stringify(obj);
  } catch (e) {
    return String(obj);
  }
}

function log(level, message, meta) {
  if (meta !== undefined) {
    console.log(`[${nowISO()}] [${level}] ${message} - ${safeStringify(meta)}`);
  } else {
    console.log(`[${nowISO()}] [${level}] ${message}`);
  }
}

module.exports = {
  info: (msg, meta) => log('INFO', msg, meta),
  warn: (msg, meta) => log('WARN', msg, meta),
  error: (msg, meta) => log('ERROR', msg, meta),
  debug: (msg, meta) => log('DEBUG', msg, meta),
  sql: (sql, params) => log('SQL', sql + ' -- params: ' + safeStringify(params)),
};
