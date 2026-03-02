package boundless.spring.help;

import java.io.IOException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Properties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.BeanInitializationException;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.context.support.PropertySourcesPlaceholderConfigurer;
import org.springframework.core.io.Resource;

import boundless.console.ApplicationUtility;
import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.utility.ConvertUtility;
import boundless.utility.IPUtility;
import boundless.utility.ProgArgsHelper;
import boundless.utility.StringUtility;

public class PropertyPlaceholder extends PropertySourcesPlaceholderConfigurer {
	private static Logger log = LoggerFactory.getLogger(PropertyPlaceholder.class);
	
	private static Properties globalProperties = new Properties();
	
	private static boolean hasSetAppServer = false;
	
	public static void addPropperties(String propfile){
		Properties prop = FileUtility.getProperties(propfile);
		ProgArgsHelper.convertProperties(prop);
		for(Map.Entry<Object, Object> entry : prop.entrySet()){
			String key = (String)entry.getKey();
			String val = (String)entry.getValue();
			globalProperties.setProperty(key, val);
		}
	}
	
	
	@Override
	public void setLocations(Resource... locations) {
		long st = System.nanoTime();
		super.setLocations(locations);
		try {
			globalProperties = mergeProperties();
			ProgArgsHelper.convertProperties(globalProperties);
			AppLoggers.initConsoleAppender();
		}catch (IOException ex) {
			throw new BeanInitializationException("Could not load properties", ex);
		}finally{
			QueueLog.info(log, "finish init properties in {} ms", (System.nanoTime()-st)/1000000);
		}
	}
	

	@Override
	protected String convertPropertyValue(String originalValue) {
		String orgv = originalValue.trim();
		if(StringUtility.isNullOrEmpty(orgv)){
			return "";
		}
		String[] ips = IPUtility.getLocalIps();
		if(ips == null || ips.length == 0){
			return orgv.replace("$APP_PATH", ApplicationUtility.getAppPath());
		}
		String localip = ips[0];
		String resstr = orgv.replace("$127.0.0.1", localip).replace("$LOCALHOST", localip)
				.replace("$APP_PATH", ApplicationUtility.getAppPath());
		return resstr;
	}
	
	public void setYamlLocations(Resource... locations) {
		YamlPropertiesFactoryBean ymlFac = new YamlPropertiesFactoryBean();
		ymlFac.setResources(locations);
		Properties props = ymlFac.getObject();
		this.setProperties(props);
		try {
			globalProperties = mergeProperties();
			ProgArgsHelper.convertProperties(globalProperties);
			AppLoggers.initConsoleAppender();
		}catch (IOException ex) {
			throw new BeanInitializationException("Could not load properties", ex);
		}
	}
	
	public static boolean hasSetAppServer(){
		return hasSetAppServer;
	}

	public static void setAppServer(String approot, String appserver){
		if(hasSetAppServer){
			return;
		}
		for(Entry<Object, Object> entry : globalProperties.entrySet()){
			if(StringUtility.isNullOrEmpty(entry.getValue())){
				continue;
			}
			String v = entry.getValue().toString().replace("$APPSERVER", appserver).replace("$APPROOT", approot);
			entry.setValue(v);
		}
		
		hasSetAppServer = true;
	}

	public static String getProperty(String key){
		try{
			if(key == null){
				return "";
			}
			Object value = globalProperties.get(key);
			if(value == null){
				return key;
			}
			return ConvertUtility.getValueAsString(value);
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
		return key;
	}
	
	public static String getProperty(String key, String defaultVal){
		try{
			if(StringUtility.isNullOrEmpty(key)){
				return defaultVal;
			}
			Object value = globalProperties.get(key);
			if(value == null) {
				return defaultVal;
			}

			return ConvertUtility.getValueAsString(value);
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
		return defaultVal;
	}
	
	public static Object getPropertyWithDef(String key, Object defaultVal){
		try{
			if(StringUtility.isNullOrEmpty(key)){
				return defaultVal;
			}
			Object value = globalProperties.get(key);
			if(value == null) {
				return defaultVal;
			}
			return value;
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
		return defaultVal;
	}
	
	public static Object getObject(String key) {
		return getPropertyWithDef(key, null);
	}
	
	public static int getProperty(String key, int defaultVal){
		Object str = getPropertyWithDef(key, defaultVal);
		return ConvertUtility.getValueAsInt(str);
	}
	
	public static long getProperty(String key, long defaultVal){
		Object str = getPropertyWithDef(key, defaultVal);
		return ConvertUtility.getValueAsLong(str);
	}
	
	public static boolean getProperty(String key, boolean defaultVal){
		Object str = getPropertyWithDef(key, defaultVal);
		return ConvertUtility.getValueAsBool(str);
	}
	
	public static double getProperty(String key, double defaultVal){
		Object str = getPropertyWithDef(key, defaultVal);
		return ConvertUtility.getValueAsDouble(str);
	}
	
	public static String getProperty(String key, Object[] params){
		String value = getProperty(key);
		String regex = "\\{[0-9]*\\}";
		String[] parts = value.split(regex);
		StringBuilder sb = new StringBuilder();
		for(int i=0; i<parts.length; i++){
			sb.append(parts[i]);
			if(i < params.length){
				sb.append(params[i]);
			}
		}
		return sb.toString();
	}
	
	public static int getPropertyAsInt(String key){
		return ConvertUtility.getValueAsInt(getProperty(key));
	}
	
	public static int getPropertyAsInt(String key, int defvalue){
		return ConvertUtility.getValueAsInt(getProperty(key), defvalue);
	}
	
	public static long getPropertyAsLong(String key){
		return ConvertUtility.getValueAsLong(getProperty(key));
	}
	
	public static boolean getPropertyAsBool(String key, boolean defaultvalue){
		return getProperty(key, defaultvalue);
	}

	public static double getPropertyAsDouble(String key){
		return ConvertUtility.getValueAsDouble(getProperty(key));
	}
	
	public static BigDecimal getPropertyAsBigDecimal(String key){
		return ConvertUtility.getValueAsBigDecimal(getProperty(key));
	}
	
	public static Object getList(String key){
		List<Object> list = new ArrayList<Object>();
		Object obj = getObject(key);
		if(obj != null) {
			return obj;
		}
		
		int i = 0;
		do {
			String realkey = String.format("%s[%d]", key, i);
			i++;
			obj = getObject(realkey);
			if(obj != null) {
				list.add(obj);
			}
		}while(obj != null);
		
		return list;
	}
	

	public static void main(String[] args){
		String str = "this is test{0} aaa.{8}.bbb{9}";
		String regex = "\\{[0-9]*\\}";

		String[] parts = str.split(regex);
		System.out.println(parts.length);
		for(String part : parts){
			System.out.println(part);
		}
		
		String teststr = "$127.0.0.1";
		String teststr2 = "$LOCALHOST";
		
		long st = System.nanoTime();
		for(int i=0; i<1000; i++){
			teststr = teststr.replace(teststr, teststr2).replace(teststr2, teststr);
			String localip = IPUtility.getLocalIps()[0];
		}
		System.out.println((System.nanoTime()-st)/1000000);
	}
	
}
