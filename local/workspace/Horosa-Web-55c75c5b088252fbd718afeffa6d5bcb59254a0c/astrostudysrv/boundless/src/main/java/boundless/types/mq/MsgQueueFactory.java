package boundless.types.mq;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;

import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;

public class MsgQueueFactory {
	private static final String MQFactoryClassKey = "mqfactoryclass";

	private static IMsgQueueFactory defaultMqFactory;
	private static Map<String, IMsgQueueFactory> queueFactories = new HashMap<String, IMsgQueueFactory>();
	
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
		List<Map<String, Object>> factories = (List<Map<String, Object>>) confmap.get(MQFactoryClassKey);
		for(Map<String, Object> fac : factories){
			String name = (String) fac.get("name");
			String clazz = (String) fac.get("class");
			String config = (String) fac.get("config");
			try {
				IMsgQueueFactory factory = build(clazz, config);
				queueFactories.put(name, factory);
				boolean deffac = ConvertUtility.getValueAsBool(fac.get("default"), false);
				if(deffac) {
					defaultMqFactory = factory;
				}
				QueueLog.info(AppLoggers.InfoLogger, "create mqfactory with name:{}, of class:{}, and config file:{}", name, clazz, config);				
			}catch(Exception e) {
				QueueLog.error(AppLoggers.ErrorLogger, "error occurs during creating mqfactory with name:{}, of class:{}, and config file:{}", name, clazz, config);				
				QueueLog.error(AppLoggers.ErrorLogger, e);
				throw new RuntimeException(e);
			}
		}
		
		if(queueFactories.size() == 1 || queueFactories == null) {
			for(IMsgQueueFactory fac : queueFactories.values()) {
				defaultMqFactory = fac;
				break;
			}
		}
		
	}
	
	private static void buildProperties(String conffilepath){
		close();
		
		Properties p = FileUtility.getProperties(conffilepath);
		String factoryclasses = p.getProperty(MQFactoryClassKey);
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
			defaultMqFactory = build(factoryclass, confpath);
			if(parts.length == 3){
				queueFactories.put(parts[0], defaultMqFactory);
				QueueLog.info(AppLoggers.InfoLogger, "create mqfactory with name:{}, of class:{}, and config file:{}", parts[0], factoryclass, confpath);
			}else{
				QueueLog.info(AppLoggers.InfoLogger, "create one mqfactory of class:{}, and config file:{}", factoryclass, confpath);
			}
		}else{
			String defaultFacKey = factories[0].split("@")[0];
			for(String fac : factories){
				String[] parts = fac.split("@");
				IMsgQueueFactory factory = build(parts[1], parts[2]);
				queueFactories.put(parts[0], factory);
				QueueLog.info(AppLoggers.InfoLogger, "create mqfactory with name:{}, of class:{}, and config file:{}", parts[0], parts[1], parts[2]);
			}
			defaultMqFactory = queueFactories.get(defaultFacKey);
		}
	}
	
	private static IMsgQueueFactory build(String factoryclass, String conffilepath){
		try{
			Class factoryclazz = Class.forName(factoryclass);
			IMsgQueueFactory factory = (IMsgQueueFactory) factoryclazz.newInstance();
			factory.build(conffilepath);
			return factory;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
		
	}
	
	public static void close(){
		try{
			if(queueFactories.isEmpty()){
				if(defaultMqFactory != null){
					defaultMqFactory.shutdown();
				}
			}else{
				for(IMsgQueueFactory factory : queueFactories.values()){
					factory.shutdown();
				}
			}
			defaultMqFactory = null;
			queueFactories.clear();
		}catch(Exception e){
			QueueLog.error(MsgQueue.log, e);
		}
	}
	
	public static MsgQueue getMsgQueue(String mqfactoryname, String queuename){
		IMsgQueueFactory factory = queueFactories.get(mqfactoryname);
		RemoteQueue queue = new RemoteQueue(factory);
		MsgQueue mq = queue.getQueue(queuename);
		return mq;
	}
	

	public void setConfig(String conffilepath){
		build(conffilepath);
	}
	
}
