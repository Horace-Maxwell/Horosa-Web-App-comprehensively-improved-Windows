package boundless.spring.help.interceptor;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.ModelAndView;

import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.spring.help.PropertyPlaceholder;
import boundless.types.Tuple;
import boundless.utility.IPUtility;
import boundless.utility.JsonUtility;
import boundless.web.help.AppServerPathHelper;

public class DebugTransParamsLogInterceptor implements HandlerInterceptor {
	private static boolean NeedTransLog = PropertyPlaceholder.getProperty("debugtransparam.need", false);
	private static boolean UseTransSet = PropertyPlaceholder.getProperty("debugtransparam.transset", false);
	private static Set<String> transSet = new HashSet<String>();
	private static Set<String> excludeTransSet = new HashSet<String>();
	
	private static String servers;

	static{
		try{
			if(UseTransSet){
				String json = FileUtility.getStringFromClassPath("conf/log/debuglogtrans.json");
				transSet = JsonUtility.decodeSet(json, String.class);
			}
			List<Tuple<String, Integer>> list = IPUtility.getServerIpPorts();
			if(!list.isEmpty()){
				StringBuilder srv = new StringBuilder();
				for(Tuple<String, Integer> addr : list) {
					srv.append(addr.item1()).append(':').append(addr.item2()).append("; ");
				}
				servers = srv.toString();
			}
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
		
		try{
			String json = FileUtility.getStringFromClassPath("conf/log/excludelogtrans.json");
			excludeTransSet = JsonUtility.decodeSet(json, String.class);
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
	}
	

	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
		if(!NeedTransLog){
			return true;
		}
		String path = request.getRequestURI();
		int idx = path.lastIndexOf('/');
		String ctx = request.getServletContext().getContextPath();
		path = path.substring(ctx.length());
		if(excludeTransSet.contains(path)){
			return true;
		}
		
		try{
			Logger log = AppLoggers.DebugLogger;
			if(UseTransSet){	
				if(transSet.contains(path)){
					String logfilename = path.replace('/', '_');
					log = AppLoggers.getLog("debug", logfilename);					
				}else{
					return true;
				}
			}
			String userip = AppServerPathHelper.getClientIp(request);
			String data = TransData.getRequestJsonWithHead();
			QueueLog.debug(log, "userip:{} requestUrl:{}?{}\n request data:\n{} ", 
					userip, request.getRequestURI(), request.getQueryString(), data);
			
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
		
		return true;
	}

	@Override
	public void postHandle(HttpServletRequest request,
			HttpServletResponse response, Object handler,
			ModelAndView modelAndView) throws Exception {
	}

	@Override
	public void afterCompletion(HttpServletRequest request,
			HttpServletResponse response, Object handler, Exception ex)
			throws Exception {
	}

}
