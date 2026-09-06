import Redis from 'ioredis';

let _client: Redis | null = null;

export function getRedisClient(): Redis {
  if (!_client) {
    _client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    _client.on('error', (err) => console.error('[Redis] Error:', err.message));
    _client.on('ready', () => console.log('[Redis] Connected'));
  }
  return _client;
}
