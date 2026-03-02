package boundless.types.mq.redis;

import java.util.Collection;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

import org.apache.commons.pool2.impl.GenericObjectPoolConfig;

import boundless.io.FileUtility;
import boundless.log.QueueLog;
import boundless.types.ICache;
import boundless.types.OutParameter;
import boundless.types.Tuple;
import boundless.types.cache.JedisCache;
import boundless.types.cache.ShardedJedisCache;
import boundless.types.mq.IMsgQueueFactory;
import boundless.types.mq.MsgQueue;
import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;
import redis.clients.jedis.Jedis;
import redis.clients.jedis.JedisPool;
import redis.clients.jedis.JedisShardInfo;
import redis.clients.jedis.ShardedJedis;
import redis.clients.jedis.ShardedJedisPool;

public class RedisQueueFactory implements IMsgQueueFactory {

	private static boolean needCheck = false;
	private static int checkInterval = 60000;
	private static ExecutorService executor = null;
	
	private JedisPool pool;
	private ShardedJedisPool sharePool;
	
	private Map<String, Tuple<RedisQueue, OutParameter<Integer>>> queues = new ConcurrentHashMap<String, Tuple<RedisQueue, OutParameter<Integer>>>();
	

	@Override
	public void build(String proppath) {
		shutdown();
		
		Properties p = FileUtility.getProperties(proppath);
		int maxTotal = ConvertUtility.getValueAsInt(p.get("redis.pool.maxTotal"));
		int maxIdle = ConvertUtility.getValueAsInt(p.get("redis.pool.maxIdle"));
		long maxWait = ConvertUtility.getValueAsLong(p.get("redis.pool.maxWaitMillis"));
		int timeout = ConvertUtility.getValueAsInt(p.get("redis.pool.timeout"));
		boolean testOnBorrow = ConvertUtility.getValueAsBool(p.get("redis.pool.testOnBorrow"), true);
		boolean testOnReturn = ConvertUtility.getValueAsBool(p.get("redis.pool.testOnReturn"), true);

		needCheck = ConvertUtility.getValueAsBool(p.getProperty("needcheck"), true);
		int chkinterval = ConvertUtility.getValueAsInt(p.getProperty("checkinterval"));
		if(chkinterval > 0){
			checkInterval = chkinterval;
		}

		
		String pwd = ConvertUtility.getValueAsString(p.get("redis.pwd"));
		String ips = ConvertUtility.getValueAsString(p.get("redis.ips"));
		
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
			
			String ip = ConvertUtility.getValueAsString(p.get("redis.ip"));
			int port = ConvertUtility.getValueAsInt(p.get("redis.port"));

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

		if(needCheck){
			if(executor != null) {
				try {
					executor.shutdownNow();
				}catch(Exception e) {
					QueueLog.error(MsgQueue.log, e);
				}
			}
			
			executor = new ThreadPoolExecutor(1, 1,
                    0L, TimeUnit.MILLISECONDS,
                    new SynchronousQueue<Runnable>());
			executor.execute(()->{
				try{
					while(true){
						boolean needsleep = false;
						Tuple<RedisQueue, OutParameter<Integer>>[] tuples = getTuples();
						for(Tuple<RedisQueue, OutParameter<Integer>> tuple : tuples){
							try{
								boolean tmp = tuple.item1().checkMsgOnce();
								if(tmp == false){
									needsleep = true;
								}
							}catch(Exception e){
								QueueLog.error(MsgQueue.log, e);
							}
						}
						if(needsleep || tuples.length == 0){
							Thread.sleep(checkInterval);
						}
					}
				}catch(Exception e){
					QueueLog.error(MsgQueue.log, e);
				}
			});
		}

	}

	ICache getCache(){
		if(pool != null){
			Jedis jedis = pool.getResource();
			return new JedisCache(jedis);
		}
		if(sharePool != null){
			ShardedJedis jedis = sharePool.getResource();
			return new ShardedJedisCache(jedis);
		}
		
		throw null;
	}


	@Override
	public MsgQueue getMsgQueue(String queuename) {
		Tuple<RedisQueue, OutParameter<Integer>> queue = this.queues.get(queuename);
		if(queue != null){
			queue.item2().value++;
			return queue.item1();
		}
		
		RedisQueue rq = new RedisQueue(this, queuename);
		OutParameter<Integer> cnt = new OutParameter<Integer>();
		cnt.value = 1;
		queue = new Tuple<RedisQueue, OutParameter<Integer>>(rq, cnt);
		this.queues.put(queuename, queue);
		
		return rq;
	}
	
	synchronized void deleteLocalQueue(String queuename){
		Tuple<RedisQueue, OutParameter<Integer>> queue = this.queues.get(queuename);
		if(queue == null){
			return;
		}
		
		OutParameter<Integer> cnt = queue.item2();
		cnt.value--;
		if(cnt.value <= 0){
			Tuple<RedisQueue, OutParameter<Integer>> tuple = this.queues.remove(queuename);
			tuple.item1().clearHandlers();
		}
	}

	private Tuple<RedisQueue, OutParameter<Integer>>[] getTuples(){
		Collection<Tuple<RedisQueue, OutParameter<Integer>>> collec = this.queues.values();
		Tuple<RedisQueue, OutParameter<Integer>>[] tuples = new Tuple[collec.size()];
		collec.toArray(tuples);
		
		return tuples;
	}
	
	@Override
	public synchronized void shutdown() {
		try{
			if(executor != null){
				executor.shutdown();
			}
		}catch(Exception e){
			
		}
		
		for(Tuple<RedisQueue, OutParameter<Integer>> tuple : getTuples()){
			tuple.item1().close();
		}
		
		this.queues.clear();
		
		if(pool != null){
			pool.close();
		}
		if(sharePool != null){
			sharePool.close();
		}
	}

	@Override
	public void setPropertiesPath(String proppath) {
		build(proppath);
	}

}
