const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('./index');

async function dropAll() {
    const client = await pool.connect();
    try {
        console.log('Очистка базы данных: сброс схемы public...');
        await client.query('DROP SCHEMA public CASCADE;');
        await client.query('CREATE SCHEMA public;');
        await client.query('GRANT ALL ON SCHEMA public TO postgres;');
        await client.query('GRANT ALL ON SCHEMA public TO public;');
        console.log('Схема public успешно очищена и пересоздана!');
    } catch (err) {
        console.error('Ошибка при очистке БД:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

if (require.main === module) {
    dropAll();
}

module.exports = dropAll;
