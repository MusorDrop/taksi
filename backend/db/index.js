const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
    console.error('Непредвиденная ошибка в БД', err);
    process.exit(-1);
});

module.exports = pool;
