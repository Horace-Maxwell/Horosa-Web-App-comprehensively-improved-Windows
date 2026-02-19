package boundless.spring.help.interceptor;

import java.lang.reflect.Method;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.spring.help.PropertyPlaceholder;
import boundless.utility.StringUtility;

class TransLogHelper {
	private static Method logTrans = null;

	private static Method getLogMethod() {
		if(logTrans != null) {
			return logTrans;
		}
		try{
			String clzz = PropertyPlaceholder.getProperty("translogclass", "");
			if(!StringUtility.isNullOrEmpty(clzz)){
				Class clazz = Class.forName(clzz);
				logTrans = clazz.getMethod("logTransCode", HttpServletRequest.class, HttpServletResponse.class);
			}
			return logTrans;
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e);
			return null;
		}
		
	}
	

	static void logTrans(HttpServletRequest request, HttpServletResponse response) {
		try {
	        Method logmeth = getLogMethod();
			if(logmeth != null) {
				logmeth.invoke(null, request, response);				
			}					
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}
}
