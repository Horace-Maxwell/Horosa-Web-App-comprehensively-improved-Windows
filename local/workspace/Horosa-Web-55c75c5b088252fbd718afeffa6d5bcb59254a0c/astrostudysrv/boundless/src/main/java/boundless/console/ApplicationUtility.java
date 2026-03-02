package boundless.console;

import java.io.UnsupportedEncodingException;
import java.lang.management.ManagementFactory;
import java.lang.management.ThreadInfo;
import java.lang.management.ThreadMXBean;
import java.net.URL;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.model.HierarchicalMap;
import boundless.utility.*;

public final class ApplicationUtility {
	private static Logger log = AppLoggers.InfoLogger;
	
	public static final String AppPathKey = "AppPath";
	
	private static String  AppPath;
	
	private static AppConfig _appConfig; 
	private static Class<?> _mainClass;
	private static Map<String, String> _appParams = new HashMap<String, String>();
	

	/**
	 * 保存启动信息
	 */
	public static void saveStartupInfo(){
		String name=java.lang.management.ManagementFactory.getRuntimeMXBean().getName();
		FileUtility.save(FileUtility.combinePath(getAppPath(), "processId"), name.split("@")[0]+","+FormatUtility.formatDateTime(new Date(),"yyyyMMddHHmmss"));
	}
	
	public static Class<?> getMainClass() {
		if (_mainClass != null)
			return _mainClass;

		Collection<StackTraceElement[]> stacks = Thread.getAllStackTraces().values();
		for (StackTraceElement[] currStack : stacks) {
			if (currStack.length==0)
				continue;
			StackTraceElement lastElem = currStack[currStack.length - 1];
			if (lastElem.getMethodName().equals("main")) {
				try {
					String mainClassName = lastElem.getClassName();
					_mainClass = Class.forName(mainClassName);
					return _mainClass;
				} catch (ClassNotFoundException e) {
					// bad class name in line containing main?! 
					// shouldn't happen
					e.printStackTrace();
				}
			}
		}
		String mainClassName = System.getProperty("sun.java.command");
		try {
			String[] parts = mainClassName.split(" ");
			_mainClass = Class.forName(parts[0]);
			return _mainClass;
		} catch (ClassNotFoundException e) {
			e.printStackTrace();
		}
		return null;
	}
	
	/**
	 * 获得应用程序所在路径
	 * @return
	 */
	public static String getAppPath(){
		if(!StringUtility.isNullOrEmpty(AppPath)){
			return AppPath;
		}
		String apppath = getAppParam(AppPathKey);
		if(!StringUtility.isNullOrEmpty(apppath)){
			log.info("app path:{}", apppath);
			return apppath;
		}
		
		Class<?> appClass = getMainClass();
		String cname = appClass.getName();
		if(cname.contains("org.apache.catalina.")){
			return getAppPath(ApplicationUtility.class);
		}
		return getAppPath(appClass);
	}
		
	public static void putAppParam(String key, String value){
		_appParams.put(key, value);
		_appParams.put(key.toUpperCase(), value);
	}
	
	public static String getAppParam(String key){
		return _appParams.get(key);
	}
	
	/**
	 * 获得应用程序所在路径
	 * @return
	 */
	public static String getAppPath(Class<?> projectClass){
		if(!StringUtility.isNullOrEmpty(AppPath)){
			return AppPath;
		}
		String apppath = getAppParam(AppPathKey);
		if(!StringUtility.isNullOrEmpty(apppath)){
			log.info("app path:{}", apppath);
			AppPath = apppath;
			return apppath;
		}
		
		String cname = projectClass.getName();
		log.info("class: {}", cname);
		cname = cname.replace('.', '/') + ".class";
		cname = "/" + cname;
		log.info("class path: {}", cname);
		URL resroot = projectClass.getResource("/");
		String appPath = "/";
		
		if(resroot != null){
			appPath = appPath + resroot.toString().replaceAll("file:/", "");
		}else{
			appPath = projectClass.getResource(cname).toString();
			appPath = appPath.replace("/jar:file/", "/").replace("!" + cname, "");
			appPath = appPath.replace("jar:", "").replaceAll("file:", "");
			int idx = appPath.lastIndexOf("/");
			appPath = appPath.substring(0, idx + 1);
		}
		 
        try {
        	AppPath = java.net.URLDecoder.decode(appPath,"UTF-8");
		} catch (UnsupportedEncodingException e) {
			e.printStackTrace();
		}
		log.info("app path:{}", AppPath);
        return AppPath;
	}
	
	public static String getSettingValueAsString(String key)
    {
        return app().getSettingValueAsString(key);
    }
	
	public static boolean getSettingValueAsBool(String key,boolean defaultValue)
    {
        return ConvertUtility.getValueAsBool(getSettingValueAsString(key),defaultValue);
    }
	
	public static int getSettingValueAsInt(String key)
    {
        return ConvertUtility.getValueAsInt(getSettingValueAsString(key));
    }
	
	public static long getSettingValueAsLong(String key)
    {
        return ConvertUtility.getValueAsLong(getSettingValueAsString(key));
    }
	
	public static HierarchicalMap getSection(String name)
    {
        return app().getSection(name);
    }
	
	public static HierarchicalMap[] selectConfigs(String path){
        return app().selectConfigs(path);
	}
	
	public static HierarchicalMap[] tcpServers(){
		return app().tcpServers();
	}
	
	public static HierarchicalMap[] udpServers(){
		return app().udpServers();
	}
	
	public static HierarchicalMap[] periodTasks(){
		return app().periodTasks();
	}
	
	public static HierarchicalMap[] cronTasks(){
		return app().cronTasks();
	}
	
	public static String decodeConfigValue(String value){
		String[] ips = IPUtility.getLocalIps();
		if (ips != null && ips.length > 0)
        {
            value = value.replace("$LOCALHOST", ips[0])
                .replace("$127.0.0.1", ips[0]);
        }
		value = value.replace("$APP_PATH", getAppPath());
		return value;
	}
	
	public static ConcurrentHashMap<Integer, HierarchicalMap> monitorPackets(){
		return app().monitorPackets();
	}
	
	public static void reboot(){
		HierarchicalMap[] restart = ApplicationUtility.selectConfigs("programs/restartScript");
		HierarchicalMap[] self = ApplicationUtility.selectConfigs("programs/self");
		
		String restartcmd = restart[0].getAttributeAsString("path");
		String selfcmd = self[0].getAttributeAsString("path");
		
		int pid = Diagnostic.getProcessId();
		StringBuilder sb = new StringBuilder(restartcmd);
		sb.append(" ").append(pid).append(" ").append(selfcmd);
		
		try {
			String cmd = sb.toString();
			log.info("exec: {}", cmd);
			Runtime.getRuntime().exec(cmd);
		} catch (Exception e) {
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
		
	}
	
	public static void dumpThreadInfo(String destpath){
		StringBuilder sb = new StringBuilder();
		ThreadMXBean tm = ManagementFactory.getThreadMXBean();
		ThreadInfo[] threads = tm.dumpAllThreads(true, true);
		for(ThreadInfo info : threads){
	    	sb.append("Thread:").append(info.getThreadName()).append(", state:").append(info.getThreadState().toString());
	    	sb.append(", waitTime:").append(info.getWaitedTime()).append(", waitCount:").append(info.getWaitedCount());
	    	sb.append(", blockTime:").append(info.getBlockedTime()).append(", blockCount:").append(info.getBlockedCount());
	    	sb.append(", lock:").append(info.getLockName()).append(", lockowner:").append(info.getLockOwnerName());
	    	sb.append(", stacktrace:\r\n");
	    	for(StackTraceElement elem :info.getStackTrace()){
	    		sb.append("\tat ").append(elem.toString()).append("\r\n");
	    	}
		}
		
		int pid = Diagnostic.getProcessId();
		String destfile = String.format("%s/%s/%s_%d.jstack.log", 
				destpath, FormatUtility.formatDateTime(new Date(), "yyyyMM"), 
				FormatUtility.formatDateTime(new Date(), "HH"), pid);
		FileUtility.save(destfile, sb.toString());
	}
	
	public static void jstack(String destpath){
		String jdkhome = System.getProperty("java.home");
		jdkhome = jdkhome.substring(0, jdkhome.length()-4);
		String jstack = String.format("%s/bin/jstack", jdkhome);
		if(!FileUtility.exists(jstack)){
			jstack = String.format("%s/bin/jstack.exe", jdkhome);
		}
		int pid = Diagnostic.getProcessId();
		String destfile = String.format("%s/%s/%s_%d.log", 
				destpath, FormatUtility.formatDateTime(new Date(), "yyyyMM"), 
				FormatUtility.formatDateTime(new Date(), "HH"), pid);
		FileUtility.createDirectory(destfile);
		String[] cmds = new String[]{
			jstack, "-m", "-l", pid + ""
		};
		try{
			ProcessUtility.execute(destpath, null, (lines)->{
				StringBuilder data = new StringBuilder();
				for(String line : lines){
					data.append(line);
				}
				FileUtility.save(destfile, data.toString());
			}, cmds);
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
	}
	
	
	private static AppConfig app(){
		if (_appConfig==null) _appConfig=new AppConfig();
        return _appConfig;
	}
	
	static void main(String[] args){
		System.out.println(getAppPath());
	}
	
	private static class AppConfig {
		private HierarchicalMap _map;
		private ConcurrentHashMap<String,String> _settingHt=new ConcurrentHashMap<String,String>();
		private ConcurrentHashMap<String,HierarchicalMap> _sectionHt=new ConcurrentHashMap<String,HierarchicalMap>();
		private ConcurrentHashMap<Integer, HierarchicalMap> _monitorPackets = new ConcurrentHashMap<Integer, HierarchicalMap>();

		private HierarchicalMap[] _tcpServers ;
		private HierarchicalMap[] _udpServers;
		private HierarchicalMap[] _periodTasks;
		private HierarchicalMap[] _cronTasks;
		
		public AppConfig(){
			_map=HierarchicalMap.createHierarchicalMap(FileUtility.combinePath(getAppPath(),"app.xml"));
			
			HierarchicalMap[] monitors = selectConfigs("monitor/packet");
			for(HierarchicalMap map : monitors){
				_monitorPackets.put(map.getAttributeAsInt("id"), map);
			}
			
			_tcpServers = selectConfigs("tcp_servers/server");
			_udpServers = selectConfigs("udp_servers/server");
			_periodTasks = selectConfigs("period_tasks/task");
			_cronTasks = selectConfigs("cron_tasks/task");
		}
		
		public ConcurrentHashMap<Integer, HierarchicalMap> monitorPackets(){
			return _monitorPackets;
		}
		
		public HierarchicalMap[] tcpServers(){
			return _tcpServers;
		}
		
		public HierarchicalMap[] udpServers(){
			return _udpServers;
		}
		
		public HierarchicalMap[] periodTasks(){
			return _periodTasks;
		}
		
		public HierarchicalMap[] cronTasks(){
			return _cronTasks;
		}
		
		public String getSettingValueAsString(String key){
			String value=_settingHt.get(key);
			if (value!=null) return value;
			
			HierarchicalMap node=_map;
			for(String nodeName:new String[]{"appSettings",key}){
				node=node.getNode(nodeName);
				if (node==null){
					_settingHt.put(key, "");
					return null;
				}
			}
			
			value=node.getValueAsString();
			if (StringUtility.isNullOrEmpty(value)) {
				_settingHt.put(key, value);
				return value;
			}
			
			value=decodeConfigValue(value);
            _settingHt.put(key, value);
            return value;
		}
		
		public HierarchicalMap getSection(String name){
			HierarchicalMap value=_sectionHt.get(name);
			if (value != null){
				return value;
			}
			
			HierarchicalMap node=_map;
			for(String nodeName:new String[]{"sections",name}){
				node=node.getNode(nodeName);
				if (node==null) return null;
			}
			
			_sectionHt.put(name, node);
			
			return node;
		}
		
		
		public HierarchicalMap[] selectConfigs(String path){
			return _map.selectNodes(path);
		}
	}
}
