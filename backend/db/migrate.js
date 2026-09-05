require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./index');

/**
 * Запуск миграций базы данных PostgreSQL
 */
async function runMigrations() {
    try {
        const migrationFile = path.join(__dirname, 'migrations', '002_admin_and_avatars.sql');
        const sql = fs.readFileSync(migrationFile, 'utf8');
        console.log('Выполняется миграция 002_admin_and_avatars.sql...');
        await pool.query(sql);
        console.log('Миграция 002_admin_and_avatars.sql успешно применена!');
    } catch (err) {
        console.error('Ошибка применения миграции:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    runMigrations();
}

module.exports = runMigrations;
