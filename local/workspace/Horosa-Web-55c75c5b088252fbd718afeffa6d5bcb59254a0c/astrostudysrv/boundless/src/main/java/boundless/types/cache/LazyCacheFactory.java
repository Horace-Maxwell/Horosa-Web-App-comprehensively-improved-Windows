package boundless.types.cache;

import boundless.types.ICache;

/**
 * [R3-B1] 惰性缓存工厂代理:持有 (factoryClass, confPath),首次真实使用才构造真工厂。
 *
 * 背景:桌面档 caches.json 声明 20 个工厂(18 Mongo + 2 Redis),饿构造把驱动初始化
 * 全塞进 Spring context.refresh(实测 cacheFactory bean ≈490ms),而桌面场景多数工厂
 * 全程零使用。本代理把该成本从启动关键路径挪到首用时点(未用=永不付)。
 *
 * 启用门:系统属性 horosa.cache.lazyinit=true(或 env HOROSA_CACHE_LAZYINIT=true)。
 * 缺省 false —— 服务器部署行为逐字节不变;桌面 start 脚本显式开启。
 *
 * 语义钉:
 *  · materialize 异常原样 RuntimeException 上抛 —— 与饿构造同语义,仅时点后移到首用;
 *  · needMemCache/needCompress/needHystrix 在未 materialize 时返回接口缺省值(null),
 *    不触发构造(这些探询在装配期就会被问,触发即倒退回饿构造);
 *  · close()/reconnect() 未 materialize 时为 no-op(没建过的连接无可关);
 *  · factoryName 先记名,materialize 时补写真工厂。
 */
public class LazyCacheFactory implements ICacheFactory {

	private final String factoryClass;
	private final String confPath;
	private volatile ICacheFactory real;
	private volatile String pendingName;

	public LazyCacheFactory(String factoryClass, String confPath){
		this.factoryClass = factoryClass;
		this.confPath = confPath;
	}

	private ICacheFactory real(){
		ICacheFactory r = real;
		if(r == null){
			synchronized(this){
				if(real == null){
					try{
						Class<?> clazz = Class.forName(factoryClass);
						ICacheFactory f = (ICacheFactory) clazz.newInstance();
						f.build(confPath);
						String name = pendingName;
						if(name != null){
							f.factoryName(name);
						}
						real = f;
					}catch(Exception e){
						throw new RuntimeException(e);
					}
				}
				r = real;
			}
		}
		return r;
	}

	/** 测试/诊断:是否已真构造。 */
	public boolean isMaterialized(){
		return real != null;
	}

	@Override
	public void build(String proppath){
		// 构造参数在 ctor 已持有;真 build 延后到首用(本方法保持接口兼容,零动作)。
	}

	@Override
	public ICache getCache(){
		return real().getCache();
	}

	@Override
	public void close(){
		ICacheFactory r = real;
		if(r != null){
			r.close();
		}
	}

	@Override
	public Boolean needMemCache(){
		ICacheFactory r = real;
		return r == null ? null : r.needMemCache();
	}

	@Override
	public Boolean needCompress(){
		ICacheFactory r = real;
		return r == null ? null : r.needCompress();
	}

	@Override
	public Boolean needHystrix(){
		ICacheFactory r = real;
		return r == null ? null : r.needHystrix();
	}

	@Override
	public void reconnect(){
		ICacheFactory r = real;
		if(r != null){
			r.reconnect();
		}
	}

	@Override
	public String factoryName(){
		String name = pendingName;
		return name != null ? name : this.toString();
	}

	@Override
	public void factoryName(String name){
		this.pendingName = name;
		ICacheFactory r = real;
		if(r != null){
			r.factoryName(name);
		}
	}

	@Override
	public ICacheFactory spawnFactory(String dataSetName){
		return real().spawnFactory(dataSetName);
	}
}
