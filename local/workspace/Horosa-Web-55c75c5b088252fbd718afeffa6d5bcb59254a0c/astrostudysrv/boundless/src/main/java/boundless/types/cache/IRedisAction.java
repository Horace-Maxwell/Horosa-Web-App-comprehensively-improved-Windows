package boundless.types.cache;

import redis.clients.jedis.Jedis;

public interface IRedisAction<T> {
	 T redisAction(Jedis jedis);
}
