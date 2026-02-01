// Redis معطّل - نستخدم Memory cache فقط
let client = null;
console.log('⚠️ Using memory cache only (Redis disabled)');

// Memory cache
const memoryCache = new Map();

// Cache helper functions
async function getCache(key) {
  if (client) {
    try {
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error('Cache get error:', err);
    }
  }
  return memoryCache.get(key) || null;
}

async function setCache(key, value, ttl = 300) {
  if (client) {
    try {
      await client.setEx(key, ttl, JSON.stringify(value));
    } catch (err) {
      console.error('Cache set error:', err);
    }
  }
  memoryCache.set(key, value);
  // تنضيف memory cache بعد TTL
  setTimeout(() => memoryCache.delete(key), ttl * 1000);
}

async function deleteCache(key) {
  if (client) {
    try {
      await client.del(key);
    } catch (err) {
      console.error('Cache delete error:', err);
    }
  }
  memoryCache.delete(key);
}

// Middleware لـ caching GET requests
const cacheMiddleware = (duration = 300) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    const key = `route_${req.originalUrl || req.url}`;
    const cached = await getCache(key);

    if (cached) {
      console.log(`✅ Cache hit: ${key}`);
      return res.json(cached);
    }

    // Save original json method
    const originalJson = res.json;

    res.json = function(body) {
      setCache(key, body, duration);
      return originalJson.call(this, body);
    };

    next();
  };
};

module.exports = { getCache, setCache, deleteCache, cacheMiddleware, client };
