package boundless.spring.help;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;

public class SysInitHelper {

	public static final String TaskBeanKey = "taskBean";
	public static final String TaskClassKey = "taskClass";
	public static final String InitMethodKey = "initMethod";
	public static final String InitMethodParamKey = "initMethodParam";
	
	/** 缺省开的启动开关:同名系统属性优先,其次同名环境变量;取值 0 / false / off(去首尾空白、不分大小写)为关。 */
	public static boolean flagEnabled(String key) {
		if(StringUtility.isNullOrEmpty(key)) {
			return true;
		}
		String value = System.getProperty(key);
		if(StringUtility.isNullOrEmpty(value)) {
			value = System.getenv(key);
		}
		if(StringUtility.isNullOrEmpty(value)) {
			return true;
		}
		value = value.trim();
		return !("0".equals(value) || "false".equalsIgnoreCase(value) || "off".equalsIgnoreCase(value));
	}

	/**
	 * 缺省开的回退阀:系统属性 propKey 优先(非空白才算设了),其次环境变量 envKey;
	 * 取值 false(不分大小写)或 0(均去首尾空白)为关,其余一律为开。
	 */
	public static boolean propThenEnvOn(String propKey, String envKey) {
		String prop = System.getProperty(propKey);
		if (prop != null && !prop.trim().isEmpty()) {
			return !("false".equalsIgnoreCase(prop.trim()) || "0".equals(prop.trim()));
		}
		String env = System.getenv(envKey);
		if (env != null && !env.trim().isEmpty()) {
			return !("false".equalsIgnoreCase(env.trim()) || "0".equals(env.trim()));
		}
		return true;
	}

	public void setParameters(Map<String, Object> param){
		
		String className = ConvertUtility.getValueAsString(param.get(TaskClassKey));
		String initMethod = ConvertUtility.getValueAsString(param.get(InitMethodKey));
		String initMethodParam = ConvertUtility.getValueAsString(param.get(InitMethodParamKey));
		if("spacex.astrostudy.helper.TransGroupHelper".equals(className) && !flagEnabled("HOROSA_ENABLE_STARTUP_TRANSGROUP_INIT")) {
			return;
		}
		Object bean = param.get(TaskBeanKey);
		try{
			Class clazz = null;
			if(bean != null){
				clazz = bean.getClass();
			}else{
				clazz = Class.forName(className);
			}
			Method initM = null;
			if(!StringUtility.isNullOrEmpty(initMethod)){
				if(initMethod.equalsIgnoreCase("init") || initMethod.equalsIgnoreCase("clinit")){
					throw new RuntimeException("cannot use 'init' or 'clinit' as method name");
				}
				if(StringUtility.isNullOrEmpty(initMethodParam)){
					initM = clazz.getMethod(initMethod);
				}else{
					initM = clazz.getMethod(initMethod, String.class);
				}
			}
			if(initM != null){
				if(StringUtility.isNullOrEmpty(initMethodParam)){
					initM.invoke(bean);
				}else{
					initM.invoke(bean, initMethodParam);
				}
			}
			
		}catch(Exception e){
			Throwable err = e.getCause();
			if(err == null){
				err = e;
			}
			QueueLog.error(AppLoggers.ErrorLogger, err);
			throw new RuntimeException(e);
		}
	}
	
	public void setTasks(List<Map<String, Object>> tasks){
		for(Map<String, Object> params : tasks){
			try{
				setParameters(params);
			}catch(Exception e){
				QueueLog.error(AppLoggers.ErrorLogger, e);
			}
		}
	}
	
	
}
