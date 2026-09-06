const pool = require('./index');

/**
 * Применение пространственных функциональных индексов GiST для живой базы данных
 * Ускоряет фильтрацию поездок через ST_DWithin с приведением к типу geography
 * @returns {Promise<void>}
 */
async function fixSpatialIndexes() {
    const client = await pool.connect();
    try {
        console.log('Применение пространственных индексов GiST к живой БД...');
        await client.query('BEGIN');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_rides_start_point_geog 
            ON rides USING GIST (((start_point)::geography));
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_rides_end_point_geog 
            ON rides USING GIST (((end_point)::geography));
        `);
        await client.query('COMMIT');
        console.log('Пространственные индексы успешно применены!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Ошибка создания пространственных индексов:', err);
        throw err;
    } finally {
        client.release();
    }
}

if (require.main === module) {
    fixSpatialIndexes()
        .then(async () => {
            await pool.end();
            process.exit(0);
        })
        .catch(async () => {
            await pool.end();
            process.exit(1);
        });
}

module.exports = fixSpatialIndexes;
