package boundless.types.period;


import java.lang.reflect.Method;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import boundless.log.QueueLog;
import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;
import it.sauronsoftware.cron4j.Scheduler;

public class CronTask {
	private static final Logger logger = LoggerFactory.getLogger(CronTask.class);
	
	public static final String PatternKey = "pattern";
	public static final String TaskClassKey = "taskClass";
	public static final String ScheduleMethodKey = "scheduleMethod";
	public static final String InitMethodKey = "initMethod";
	public static final String TaskBeanKey = "taskBean";
	
	private static List<Scheduler> cronList = new LinkedList<Scheduler>();
	
	public static void shutdown(){
		for(Scheduler cron : cronList){
			try{
				if(cron.isStarted()){
					cron.stop();
				}
			}catch(Exception e){
				e.printStackTrace();
			}
		}
	}
	
	private Scheduler cron = new Scheduler(); 
	private Method scheduleM;
	
	public void stop(){
		if(cron.isStarted()){
			cron.stop();
		}
	}
	
	public void setParameters(Map<String, Object> param){
		String pattern = ConvertUtility.getValueAsString(param.get(PatternKey));
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
			
			this.scheduleM = clazz.getMethod(scheduleMethod);
			
			if(initM != null){
				initM.invoke(null);
			}
			
			if(cron.isStarted()){
				cron.stop();
			}
			
			cron.schedule(pattern, ()->{
				try{
					this.scheduleM.invoke(null);
				}catch(Exception e){
					QueueLog.error(logger, e);
				}
			});
			
			cron.start();
			cronList.add(cron);

		}catch(Exception e){
			QueueLog.error(logger, e);
			throw new RuntimeException(e);
		}
	}
}
