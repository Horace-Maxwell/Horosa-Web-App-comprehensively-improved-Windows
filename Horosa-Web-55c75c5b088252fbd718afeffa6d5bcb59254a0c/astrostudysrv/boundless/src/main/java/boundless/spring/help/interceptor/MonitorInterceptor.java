package boundless.spring.help.interceptor;

import java.util.Calendar;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.springframework.core.NamedThreadLocal;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.ModelAndView;

import boundless.console.Diagnostic;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.utility.PeriodTask;

public class MonitorInterceptor implements HandlerInterceptor {
	
	private static int today = 0;
	private static long requestCounter = 0;
	private static long requestCounterToday = 0;
	static{
		Calendar cal = Calendar.getInstance();
		today = cal.get(Calendar.DAY_OF_YEAR);
				
		PeriodTask.submit(()->{
	        Calendar nowcal = Calendar.getInstance();
	        int nowdate = nowcal.get(Calendar.DAY_OF_YEAR);
	        if(nowdate != today){
	        	today = nowdate;
	        	requestCounterToday = 0;
	        }
		}, 1000, 10000);
	}
	
	public static long getRequestCounter(){
		return requestCounter;
	}
	
	public static long getTodayRequestCounter(){
		return requestCounterToday;
	}
	
	private NamedThreadLocal<Long>  startTimeThreadLocal =   
			new NamedThreadLocal<Long>("StopWatch-StartTime"); 

	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
		QueueLog.debug(AppLoggers.Access, "begin to request {}?{}", request.getRequestURI(), request.getQueryString());
        long beginTime = System.currentTimeMillis();//1、开始时间  
        request.setAttribute(KeyConstants.AttrTransBeginTimeKey, beginTime);
        
        startTimeThreadLocal.set(beginTime);//线程绑定变量（该数据只有当前请求的线程可见）  
        requestCounter++;
        requestCounterToday++;
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
        long endTime = System.currentTimeMillis();//2、结束时间  
        long beginTime = startTimeThreadLocal.get();//得到线程绑定的局部变量（开始时间）  
        long consumeTime = endTime - beginTime;//3、消耗的时间  
		QueueLog.debug(AppLoggers.Access, "complete request in {} ms, todayreqcounter:{}, totalreqcounter:{}, threadcount:{}, {}?{}", 
				consumeTime, requestCounterToday, requestCounter, Diagnostic.getThreadCount(), request.getRequestURI(), request.getQueryString());
		
        if(consumeTime > 1000) {//此处认为处理时间超过1000毫秒的请求为慢请求  
            QueueLog.debug(AppLoggers.Performance, "slow request in {} ms. todayreqcounter:{}, totalreqcounter:{}, threadcount:{}, {}?{}", 
            		consumeTime, requestCounterToday, requestCounter, Diagnostic.getThreadCount(), request.getRequestURI(), request.getQueryString());
        }   
        
	}

}
