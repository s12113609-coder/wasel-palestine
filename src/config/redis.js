const { createClient } = require('redis');

let client = null;
let connectionAttempted = false;

const getRedisClient = async() => {
    if (client && client.isOpen) return client;
    if (connectionAttempted) return null;

    connectionAttempted = true;

    client = createClient({
        socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            reconnectStrategy: false,
        },
    });

    client.on('error', () => {});

    try {
        await client.connect();
        console.log('✅ Connected to Redis');
        return client;
    } catch (err) {
        console.warn('⚠️  Redis unavailable, caching disabled');
        client = null;
        return null;
    }
};

const cacheGet = async(key) => {
    try {
        const c = await getRedisClient();
        if (!c) return null;
        const val = await c.get(key);
        return val ? JSON.parse(val) : null;
    } catch {
        return null;
    }
};

const cacheSet = async(key, value, ttlSeconds = 300) => {
    try {
        const c = await getRedisClient();
        if (!c) return;
        await c.setEx(key, ttlSeconds, JSON.stringify(value));
    } catch {}
};

const cacheDel = async(key) => {
    try {
        const c = await getRedisClient();
        if (!c) return;
        await c.del(key);
    } catch {}
};

module.exports = { getRedisClient, cacheGet, cacheSet, cacheDel };