package boundless.types.cache;

import java.util.List;
import java.util.Map;
import java.util.Set;

import redis.clients.jedis.Jedis;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.types.ICache;

public class JedisCache implements ICache {
	private Jedis redis;
	
	public JedisCache(Jedis redis){
		this.redis = redis;
	}

	@Override
	public void put(String key, Object value) {		
		this.redis.set(key, value.toString());
	}

	@Override
	public void put(String key, Object value, int timeToIdleSeconds, int timeToLiveSeconds) {
		this.redis.setex(key, (long)timeToLiveSeconds, value.toString());
	}

	@Override
	public Object get(String key) {
		return this.redis.get(key);
	}

	@Override
	public Object getHash(String map, String key) {
		return this.redis.hget(map, key);
	}
	
	@Override
	public void putHash(String map, String key, Object value){
		this.redis.hset(map, key, value.toString());
	}

	@Override
	public boolean containsKey(String key) {
		return this.redis.exists(key);
	}

	@Override
	public long remove(String key) {
		Long n = this.redis.del(key);
		if(n == null){
			return 0;
		}
		return n;
	}

	@Override
	public void clear() {
	}

	@Override
	public String getRemoteCacheName() {
		return null;
	}
	
	@Override
	public void close(){
		redis.close();
	}
	
	public Jedis getJedis(){
		return this.redis;
	}
	
	@Override
	public long lpush(String key, final String... strings){
		Long n = this.redis.lpush(key, strings);
		if(n == null){
			return 0;
		}
		return n;
	}
	
	@Override
	public String lpop(String key){ 
		return this.redis.lpop(key); 
	}
	
	@Override
	public long rpush(String key, final String... strings){
		Long n = this.redis.rpush(key, strings);
		if(n == null){
			return 0;
		}
		return n;
	}
	
	@Override
	public String rpop(String key){ 
		return this.redis.rpop(key); 
	}
	
	@Override
	public List<String> lrang(final String key, final long start, final long end){
		return this.redis.lrange(key, start, end);
	}
	
	@Override
	public Long llen(final String key){
		return this.redis.llen(key);
	}
	
	@Override
	public Long expire(final String key, final int seconds){
		return this.redis.expire(key, seconds);
	}
	
	@Override
	public Long expireAt(final String key, final long unixTime) {
		return this.redis.expireAt(key, unixTime);
	}
	
	@Override
	public Long publish(final String channel, final String message){
		return this.redis.publish(channel, message);
	}
	
	@Override
	public long inc(String key, long value){
		Long n = this.redis.incrBy(key, value);
		if(n == null){
			return 0;
		}
		return n;
	}
	
	@Override
	public long dec(String key, long value){
		Long n = this.redis.decrBy(key, value);
		if(n == null){
			return 0;
		}
		return n;
	}
	
	@Override
	public long countKey(String key){
		int sz = this.redis.keys(key).size();
		return sz;
	}
	
	@Override
	public Set<String> zrangeByScore(final String key, final double min, final double max, final int offset, final int count){
		return this.redis.zrangeByScore(key, min, max, offset, count);
	}
	

	@Override
	public Set<byte[]> zrangeByScore(final byte[] key, final double min, final double max, final int offset, final int count){
		return this.redis.zrangeByScore(key, min, max, offset, count);
	}
	
	@Override
	public Long zadd(final String key, final double score, final String member){
		return this.redis.zadd(key, score, member);
	}
	
	@Override
	public double zincrby(final String key, final double score, final String member){
		return this.redis.zincrby(key, score, member);
	}

	@Override
	public long removeMany(String partKey) {
		Set<String> keys = this.redis.keys(partKey);
		long cnt = 0;
		for(String key : keys) {
			try {
				cnt += this.redis.del(key);
			}catch(Exception e) {
				QueueLog.error(AppLoggers.ErrorLogger, e.getMessage());
			}
		}
		
		return cnt;
	}
	
}
