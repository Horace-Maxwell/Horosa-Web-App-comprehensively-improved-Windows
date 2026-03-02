package boundless.types.cache;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;

import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.types.ICache;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;

public class CacheFactory {
	private static final String CacheFactoryClassKey = "cachefactoryclass";
	private static final String NeedLocalMemcache = "needlocalmemcache";
	private static final String NeedCompressKey = "needcompress";
	private static final String NeedHystrixKey = "needhystrix";
	
	
	private static boolean NeedMemCache = false;
	private static boolean NeedCompress = false;
	private static boolean NeedHystrix = false;
	
	private static ICacheFactory defaultCacheFactory = null;
	
	private static Map<String, ICacheFactory> cacheFactories = new HashMap<String, ICacheFactory>();
	
	
	public static void build(String conffilepath) {
		if(conffilepath.toLowerCase().endsWith(".json")) {
			buildJson(conffilepath);
		}else {
			buildProperties(conffilepath);
		}
	}
	
	private static void buildJson(String conffilepath){
		close();
		
		String json = FileUtility.getStringFromPath(conffilepath);
		Map<String, Object> confmap = JsonUtility.toDictionary(json);
		
		NeedMemCache = ConvertUtility.getValueAsBool(confmap.get(NeedLocalMemcache), false);
		NeedCompress = ConvertUtility.getValueAsBool(confmap.get(NeedCompressKey), false);
		NeedHystrix = ConvertUtility.getValueAsBool(confmap.get(NeedHystrixKey), false);
		
		List<Map<String, Object>> factories = (List<Map<String, Object>>) confmap.get(CacheFactoryClassKey);
		for(Map<String, Object> fac : factories){
			String name = (String) fac.get("name");
			String clazz = (String) fac.get("class");
			String config = (String) fac.get("config");
			try {
				ICacheFactory factory = build(clazz, config);
				cacheFactories.put(name, factory);
				factory.factoryName(name);
				boolean deffac = ConvertUtility.getValueAsBool(fac.get("default"), false);
				if(deffac) {
					defaultCacheFactory = factory;
				}
				QueueLog.info(AppLoggers.InfoLogger, "create cachefactory with name:{}, of class:{}, and config file:{}", name, clazz, config);				
			}catch(Exception e) {
				QueueLog.error(AppLoggers.ErrorLogger, "error occurs during creating cachefactory with name:{}, of class:{}, and config file:{}", name, clazz, config);	
				QueueLog.error(AppLoggers.ErrorLogger, e);
				throw new RuntimeException(e);
			}
		}
		
		if(cacheFactories.size() == 1 || defaultCacheFactory == null) {
			for(ICacheFactory fac : cacheFactories.values()) {
				defaultCacheFactory = fac;
				break;
			}
		}
	}
	
	private static void buildProperties(String conffilepath){
		close();
		
		Properties p = FileUtility.getProperties(conffilepath);
		String factoryclasses = p.getProperty(CacheFactoryClassKey);
		NeedMemCache = ConvertUtility.getValueAsBool(p.getProperty(NeedLocalMemcache), false);
		NeedCompress = ConvertUtility.getValueAsBool(p.getProperty(NeedCompressKey), false);
		NeedHystrix = ConvertUtility.getValueAsBool(p.getProperty(NeedHystrixKey), false);
		
		String[] factories = factoryclasses.split(",");
		if(factories.length < 2){
			String factoryclass = null;
			String confpath = conffilepath;
			String[] parts = factories[0].split("@");
			if(parts.length == 1){
				factoryclass = parts[0];
			}else if(parts.length == 2){
				factoryclass = parts[0];
				confpath = parts[1];
			}else if(parts.length == 3){
				factoryclass = parts[1];
				confpath = parts[2];
			}
			defaultCacheFactory = build(factoryclass, confpath);
			if(parts.length == 3){
				cacheFactories.put(parts[0], defaultCacheFactory);
				defaultCacheFactory.factoryName(parts[0]);
				QueueLog.info(AppLoggers.InfoLogger, "create cachefactory with name:{}, of class:{}, and config file:{}", parts[0], factoryclass, confpath);
			}else{
				QueueLog.info(AppLoggers.InfoLogger, "create one cachefactory of class:{}, and config file:{}", factoryclass, confpath);
			}
		}else{
			String defaultFacKey = factories[0].split("@")[0];
			for(String fac : factories){
				String[] parts = fac.split("@");
				ICacheFactory factory = build(parts[1], parts[2]);
				cacheFactories.put(parts[0], factory);
				factory.factoryName(parts[0]);
				QueueLog.info(AppLoggers.InfoLogger, "create cachefactory with name:{}, of class:{}, and config file:{}", parts[0], parts[1], parts[2]);
			}
			defaultCacheFactory = cacheFactories.get(defaultFacKey);
		}
		
	}
	
	
	private static ICacheFactory build(String factoryclass, String conffilepath){
		try{
			Class factoryclazz = Class.forName(factoryclass);
			ICacheFactory factory = (ICacheFactory) factoryclazz.newInstance();
			factory.build(conffilepath);
			return factory;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}

	public static ICache getCache(){
		RemoteCache realcache = new RemoteCache(defaultCacheFactory, NeedMemCache, NeedCompress, NeedHystrix);
		return realcache;
	}
	
	public static ICache getCache(String whichFactory){
		ICacheFactory factory = cacheFactories.get(whichFactory);
		if(factory == null){
			QueueLog.error(AppLoggers.ErrorLogger, "no found cache factory: {}, so cache return.", whichFactory);
			return null;
		}
		Boolean needmc = factory.needMemCache();
		Boolean needcompress = factory.needCompress();
		Boolean needhystrix = factory.needHystrix();
		if(needmc == null){
			needmc = NeedMemCache;
		}
		if(needcompress == null){
			needcompress = NeedCompress;
		}
		if(needhystrix == null){
			needhystrix = NeedHystrix;
		}
		RemoteCache realcache = new RemoteCache(factory, needmc, needcompress, needhystrix);
		return realcache;
	}
	
	public static void close(){
		try{
			if(cacheFactories.isEmpty()){
				if(defaultCacheFactory != null){
					defaultCacheFactory.close();
				}
			}else{
				for(ICacheFactory factory : cacheFactories.values()){
					factory.close();
				}
			}
			defaultCacheFactory = null;
			cacheFactories.clear();
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
	}
	
	public void setConfig(String conffilepath){
		build(conffilepath);
	}
}
