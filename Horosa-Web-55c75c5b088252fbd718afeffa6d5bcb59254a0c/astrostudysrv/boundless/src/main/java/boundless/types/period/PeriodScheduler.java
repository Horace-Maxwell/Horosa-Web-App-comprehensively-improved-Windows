package boundless.types.period;

import java.lang.reflect.Method;
import java.util.Map;
import java.util.concurrent.ScheduledFuture;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import boundless.log.QueueLog;
import boundless.utility.ConvertUtility;
import boundless.utility.PeriodTask;
import boundless.utility.StringUtility;

public class PeriodScheduler {
	private static final Logger logger = LoggerFactory.getLogger(PeriodScheduler.class);
	
	public static final String DelayKey = "delay";
	public static final String PeriodKey = "period";
	public static final String TaskClassKey = "taskClass";
	public static final String ScheduleMethodKey = "scheduleMethod";
	public static final String InitMethodKey = "initMethod";
	public static final String TaskBeanKey = "taskBean";
	
	private ScheduledFuture future;
	private Method scheduleM;
	
	public void stop(){
		if(future != null){
			future.cancel(true);
		}
	}
	
	public void setParameters(Map<String, Object> param){
		long delay = ConvertUtility.getValueAsLong(param.get(DelayKey));
		long period = ConvertUtility.getValueAsLong(param.get(PeriodKey));
		String className = ConvertUtility.getValueAsString(param.get(TaskClassKey));
		String scheduleMethod = ConvertUtility.getValueAsString(param.get(ScheduleMethodKey));
		String initMethod = ConvertUtility.getValueAsString(param.get(InitMethodKey));
		Object bean = param.get(TaskBeanKey);
		try{
			Class clazz = null;
			if(bean != null){
				clazz = bean.getClass();
			}else{
				clazz = Class.forName(className);
			}
			Method initM = null;
			try{
				if(!StringUtility.isNullOrEmpty(initMethod)){
					if(initMethod.equalsIgnoreCase("init") || initMethod.equalsIgnoreCase("clinit")){
						throw new RuntimeException("cannot use 'init' or 'clinit' as method name");
					}
					initM = clazz.getMethod(initMethod);
				}
			}catch(Exception NoSuchMethodException){
				
			}
			
			if(future != null){
				future.cancel(true);
			}

			if(initM != null){
				initM.invoke(bean);
			}
			
			this.scheduleM = clazz.getMethod(scheduleMethod);
			
			future = PeriodTask.submit(()->{
				try{
					this.scheduleM.invoke(bean);
				}catch(Exception e){
					Throwable err = e.getCause();
					if(err == null){
						err = e;
					}
					QueueLog.error(logger, err);
				}
			}, delay*1000, period*1000);
		}catch(Exception e){
			QueueLog.error(logger, e);
			throw new RuntimeException(e);
		}
	}

	public void cancle(){
		if(this.future != null){
			this.future.cancel(true);
		}
	}

}
