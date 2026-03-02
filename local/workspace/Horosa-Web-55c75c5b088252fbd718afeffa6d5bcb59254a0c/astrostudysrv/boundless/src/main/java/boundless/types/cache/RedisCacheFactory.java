package boundless.types.cache;

import java.util.LinkedList;
import java.util.List;
import java.util.Properties;

import org.apache.commons.pool2.impl.GenericObjectPoolConfig;

import redis.clients.jedis.Jedis;
import redis.clients.jedis.JedisPool;
import redis.clients.jedis.JedisShardInfo;
import redis.clients.jedis.Protocol;
import redis.clients.jedis.ShardedJedis;
import redis.clients.jedis.ShardedJedisPool;
import boundless.io.FileUtility;
import boundless.log.QueueLog;
import boundless.types.ICache;
import boundless.utility.ConvertUtility;
import boundless.utility.ProgArgsHelper;
import boundless.utility.StringUtility;

class RedisCacheFactory implements ICacheFactory {
	
	private JedisPool pool;
	private ShardedJedisPool sharePool;
	
	private String pwd;
	private String ips;
	private String ip;
	private int port;
	private int database;
	private int timeout;
	private String name;
	
	private int maxTotal;
	private int maxIdle;
	private long maxWait;
	private boolean testOnBorrow;
	private boolean testOnReturn;
	private Object nmcobj;
	private Object ncompress;
	
	private Boolean needMemCache = null;
	private Boolean needCompress = null;

	@Override
	public synchronized void build(String proppath){
		close();
		
		Properties p = FileUtility.getProperties(proppath);
		ProgArgsHelper.convertProperties(p);
		
		maxTotal = ConvertUtility.getValueAsInt(p.get("redis.pool.maxTotal"));
		maxIdle = ConvertUtility.getValueAsInt(p.get("redis.pool.maxIdle"));
		maxWait = ConvertUtility.getValueAsLong(p.get("redis.pool.maxWaitMillis"));
		timeout = ConvertUtility.getValueAsInt(p.get("redis.pool.timeout"), 30000);
		testOnBorrow = ConvertUtility.getValueAsBool(p.get("redis.pool.testOnBorrow"), true);
		testOnReturn = ConvertUtility.getValueAsBool(p.get("redis.pool.testOnReturn"), true);
		nmcobj = p.get("needlocalmemcache");
		if(nmcobj != null){
			this.needMemCache = ConvertUtility.getValueAsBool(nmcobj, false);
		}
		ncompress = p.get("needcompress");
		if(ncompress != null){
			needCompress = ConvertUtility.getValueAsBool(ncompress, false);
		}
		
		pwd = ConvertUtility.getValueAsString(p.get("redis.pwd"));
		ips = ConvertUtility.getValueAsString(p.get("redis.ips"));
		
		if(StringUtility.isNullOrEmpty(ips)){
			GenericObjectPoolConfig<Jedis> config = new GenericObjectPoolConfig<Jedis>();
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
			
			ip = ConvertUtility.getValueAsString(p.get("redis.ip"));				
			port = ConvertUtility.getValueAsInt(p.get("redis.port"));				
			
			port = ConvertUtility.getValueAsInt(p.get("redis.port"));
			database = ConvertUtility.getValueAsInt(p.get("redis.database"), Protocol.DEFAULT_DATABASE);

			if(StringUtility.isNullOrEmpty(pwd)){
				pool = new JedisPool(config, ip, port, timeout, null, database);
			}else{
				pool = new JedisPool(config, ip, port, timeout, pwd, database);
			}
		}else{
			GenericObjectPoolConfig<ShardedJedis> config = new GenericObjectPoolConfig<ShardedJedis>();
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
			sharePool = new ShardedJedisPool(config, list);
		}
		
	}
	
	public void build(){
		String path = "classpath:/conf/properties/jedis.properties";
		build(path);
	}
	
	@Override
	public void reconnect(){
		try{
			close();
			System.gc();
			
			if(StringUtility.isNullOrEmpty(ips)){
				GenericObjectPoolConfig<Jedis> config = new GenericObjectPoolConfig<Jedis>();
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
				GenericObjectPoolConfig<ShardedJedis> config = new GenericObjectPoolConfig<ShardedJedis>();
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
				sharePool = new ShardedJedisPool(config, list);
			}
			
		}catch(Exception e){
			QueueLog.error(ICache.log, e);
		}
	}
	
	@Override
	public void close(){
		if(pool != null){
			pool.close();
			pool = null;
		}
		if(sharePool != null){
			sharePool.close();
			sharePool = null;
		}
	}
	
	@Override
	public ICache getCache(){
		if(pool != null){
			Jedis jedis = pool.getResource();
			return new JedisCache(jedis);
		}
		if(sharePool != null){
			ShardedJedis jedis = sharePool.getResource();
			return new ShardedJedisCache(jedis);
		}
		return null;
	}
	
	public Jedis getJedis(){
		if(pool == null){
			return null;
		}
		return pool.getResource();
	}
	
	public ShardedJedis getShardedJedis(){
		if(sharePool == null){
			return null;
		}
		return sharePool.getResource();
	}
	
	public void setPropertiesPath(String proppath){
		build(proppath);
	}
	
	@Override
	public Boolean needMemCache(){
		return this.needMemCache;
	}
	
	@Override
	public Boolean needCompress(){
		return this.needCompress;
	}
	
	@Override
	public String factoryName() {
		return this.name;
	}

	@Override
	public void factoryName(String name) {
		this.name = name;
	}

}
