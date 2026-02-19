package boundless.types.storage;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;

import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;

public class CloudStorageFactory {
	private static final String CloudStorageFactoryClassKey = "cloudstoragefactoryclass";
	
	private static ICloudStorageFactory defaultFactory;
	private static Map<String, ICloudStorageFactory> storagesFactories = new HashMap<String, ICloudStorageFactory>();
	
	public static void build(String conffilepath) {
		if(conffilepath.toLowerCase().endsWith(".json")) {
			buildJson(conffilepath);
		}else {
			buildProperties(conffilepath);
		}
	}
	
	private static void buildJson(String conffilepath) {
		String json = FileUtility.getStringFromPath(conffilepath);
		Map<String, Object> confmap = JsonUtility.toDictionary(json);
		List<Map<String, Object>> factories = (List<Map<String, Object>>) confmap.get(CloudStorageFactoryClassKey);
		for(Map<String, Object> fac : factories){
			String name = (String) fac.get("name");
			String clazz = (String) fac.get("class");
			String config = (String) fac.get("config");
			try {
				ICloudStorageFactory factory = build(clazz, config);
				storagesFactories.put(name, factory);
				boolean deffac = ConvertUtility.getValueAsBool(fac.get("default"), false);
				if(deffac) {
					defaultFactory = factory;
				}
				QueueLog.info(AppLoggers.InfoLogger, "create cloudStoragefactory with name:{}, of class:{}, and config file:{}", name, clazz, config);				
			}catch(Exception e) {
				QueueLog.error(AppLoggers.ErrorLogger, "error ocurrs during creating cloudStoragefactory with name:{}, of class:{}, and config file:{}", name, clazz, config);				
				QueueLog.error(AppLoggers.ErrorLogger, e);
				throw new RuntimeException(e);
			}
		}
		
		if(storagesFactories.size() == 1 || storagesFactories == null) {
			for(ICloudStorageFactory fac : storagesFactories.values()) {
				defaultFactory = fac;
				break;
			}
		}
		
	}
	
	private static void buildProperties(String conffilepath){
		Properties p = FileUtility.getProperties(conffilepath);
		String factoryclasses = p.getProperty(CloudStorageFactoryClassKey);
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
			defaultFactory = build(factoryclass, confpath);
			if(parts.length == 3){
				storagesFactories.put(parts[0], defaultFactory);
				QueueLog.info(AppLoggers.InfoLogger, "create cloudStoragefactory with name:{}, of class:{}, and config file:{}", parts[0], factoryclass, confpath);
			}else{
				QueueLog.info(AppLoggers.InfoLogger, "create one cloudStoragefactory of class:{}, and config file:{}", factoryclass, confpath);
			}
		}else{
			String defaultFacKey = factories[0].split("@")[0];
			for(String fac : factories){
				String[] parts = fac.split("@");
				ICloudStorageFactory factory = build(parts[1], parts[2]);
				storagesFactories.put(parts[0], factory);
				QueueLog.info(AppLoggers.InfoLogger, "create cloudStoragefactory with name:{}, of class:{}, and config file:{}", parts[0], parts[1], parts[2]);
			}
			defaultFactory = storagesFactories.get(defaultFacKey);
		}
		
	}
	
	private static ICloudStorageFactory build(String factoryclass, String conffilepath){
		try{
			Class factoryclazz = Class.forName(factoryclass);
			ICloudStorageFactory factory = (ICloudStorageFactory)factoryclazz.getDeclaredConstructor().newInstance();
			factory.build(conffilepath);
			return factory;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static ICloudStorage getStorage(String factoryName) {
		return getStorage(factoryName, null, null);
	}
	
	public static ICloudStorage getStorage(String factoryName, String bucketName, String bucketDomain){
		ICloudStorageFactory factory = storagesFactories.get(factoryName);
		return factory.getCloudStorage(bucketName, bucketDomain);
	}
	
	public void setConfig(String conffilepath){
		build(conffilepath);
	}

}
