const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();
const fs = require('fs');
const pool = require('./index');

/**
 * Запуск миграций базы данных PostgreSQL
 */
async function runMigrations() {
    const client = await pool.connect();
    try {
        // Создаем таблицу для отслеживания примененных миграций
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(255) PRIMARY KEY,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Проверяем, была ли БД инициализирована ранее (до создания schema_migrations)
        const tableCheck = await client.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'users';
        `);
        const usersTableExists = tableCheck.rows.length > 0;

        if (usersTableExists) {
            await client.query(`
                INSERT INTO schema_migrations (version) 
                VALUES ('001_initial_schema.sql') 
                ON CONFLICT (version) DO NOTHING;
            `);
        }

        const appliedRes = await client.query('SELECT version FROM schema_migrations;');
        const applied = new Set(appliedRes.rows.map((r) => r.version));

        const migrationsDir = path.join(__dirname, 'migrations');
        const files = fs.readdirSync(migrationsDir)
            .filter((f) => f.endsWith('.sql'))
            .sort();

        for (const file of files) {
            if (!applied.has(file)) {
                console.log(`Выполняется миграция ${file}...`);
                const filePath = path.join(migrationsDir, file);
                const sql = fs.readFileSync(filePath, 'utf8');

                await client.query(sql);
                await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
                console.log(`Миграция ${file} успешно применена!`);
            } else {
                console.log(`Миграция ${file} уже применена, пропуск.`);
            }
        }
    } catch (err) {
        console.error('Ошибка применения миграции:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

if (require.main === module) {
    runMigrations();
}

module.exports = runMigrations;
