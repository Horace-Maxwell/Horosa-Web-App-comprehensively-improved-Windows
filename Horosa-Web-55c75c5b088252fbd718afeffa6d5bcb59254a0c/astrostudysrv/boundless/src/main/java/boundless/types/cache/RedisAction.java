package boundless.types.cache;

import java.util.LinkedList;
import java.util.List;
import java.util.Properties;

import redis.clients.jedis.Jedis;
import redis.clients.jedis.JedisPool;
import redis.clients.jedis.JedisPoolConfig;
import redis.clients.jedis.JedisShardInfo;
import redis.clients.jedis.ShardedJedis;
import redis.clients.jedis.ShardedJedisPool;
import boundless.io.FileUtility;
import boundless.log.QueueLog;
import boundless.types.ICache;
import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;

public class RedisAction {
	
	private JedisPool pool;
	//private ShardedJedisPool sharePool;
	
	private String pwd;
	private String ips;
	private String ip;
	private int port;
	private int timeout;
	
	private JedisPoolConfig config;


	public  RedisAction(String proppath){
		Properties p = FileUtility.getProperties(proppath);
		int maxTotal = ConvertUtility.getValueAsInt(p.get("redis.pool.maxTotal"));
		int maxIdle = ConvertUtility.getValueAsInt(p.get("redis.pool.maxIdle"));
		long maxWait = ConvertUtility.getValueAsLong(p.get("redis.pool.maxWaitMillis"));
		timeout = ConvertUtility.getValueAsInt(p.get("redis.pool.timeout"));
		boolean testOnBorrow = ConvertUtility.getValueAsBool(p.get("redis.pool.testOnBorrow"), true);
		boolean testOnReturn = ConvertUtility.getValueAsBool(p.get("redis.pool.testOnReturn"), true);
		
		config = new JedisPoolConfig();
		if(maxTotal > 0){
			config.setMaxTotal(maxTotal);
		}
		if(maxIdle > 0){
			config.setMaxIdle(maxIdle);
		}
		if(maxWait > 0){
			config.setMaxWaitMillis(maxWait);
		}
		config.setTestOnBorrow(testOnBorrow);
		config.setTestOnReturn(testOnReturn);
		
		pwd = ConvertUtility.getValueAsString(p.get("redis.pwd"));
		ips = ConvertUtility.getValueAsString(p.get("redis.ips"));
		
		if(StringUtility.isNullOrEmpty(ips)){
			ip = ConvertUtility.getValueAsString(p.get("redis.ip"));
			port = ConvertUtility.getValueAsInt(p.get("redis.port"));

			if(StringUtility.isNullOrEmpty(pwd)){
				pool = new JedisPool(config, ip, port);
			}else{
				if(timeout > 0){
					pool = new JedisPool(config, ip, port, timeout, pwd);
				}else{
					pool = new JedisPool(config, ip, port, 30000, pwd);
				}
			}
		}else{
			List<JedisShardInfo> list = new LinkedList<JedisShardInfo>();
			String[] parts = ips.split(",");
			for(String str : parts){
				String[] ipport = str.split(":");
				JedisShardInfo si = new JedisShardInfo(ipport[0], ConvertUtility.getValueAsInt(ipport[1]));
				if(!StringUtility.isNullOrEmpty(pwd)){
					si.setPassword(pwd);
				}
				list.add(si);
			}
			//sharePool = new ShardedJedisPool(config, list);
		}
		
	}
	
	public Jedis getJedis(){
		if(pool == null){
			return null;
		}
		return pool.getResource();
	}
	
	public <T>  T doAction(IRedisAction<T> action)
	{
	
		Jedis  jedis = getJedis();
		 
		 try
		 {
			 if(jedis != null)
				  return action.redisAction(jedis);
		 }
		 catch (Exception e) {
			 QueueLog.error(ICache.log, e);
		}
		 finally
		 {
			if(jedis != null) {
				jedis.close();
			}
		 }
		 
		 return null;
	}
	
//	public ShardedJedis getShardedJedis(){
//		if(sharePool == null){
//			return null;
//		}
//		return sharePool.getResource();
//	}

}
