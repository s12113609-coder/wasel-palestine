const knex = require('knex')({
    client: 'pg',
    connection: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'wasel_db',
        user: process.env.DB_USER || 'wasel_user',
        password: process.env.DB_PASSWORD || 'wasel_pass_2026',
    },
    pool: { min: 2, max: 10 },
    acquireConnectionTimeout: 10000,
});

module.exports = knex;