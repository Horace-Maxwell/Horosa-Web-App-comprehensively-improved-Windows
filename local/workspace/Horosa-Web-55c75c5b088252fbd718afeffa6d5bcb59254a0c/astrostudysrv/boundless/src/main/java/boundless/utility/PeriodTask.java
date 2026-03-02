package boundless.utility;

import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.types.ExecutionGroup;

public class PeriodTask {
	private static Logger log = LoggerFactory.getLogger(PeriodTask.class);
	
	private static ExecutionGroup.ExeGroupThreadFactory threadFactory = new ExecutionGroup.ExeGroupThreadFactory("PeriodTask");
	private static ScheduledExecutorService executor = new ScheduledThreadPoolExecutor(64, threadFactory);
	
	public static ScheduledFuture submit(Runnable command, long initialDelayMS, long periodMS){
		return executor.scheduleWithFixedDelay(new Runnable(){
			@Override
			public void run() {
				try{
					command.run();
				}catch(Exception e){
					QueueLog.error(AppLoggers.ErrorLogger, e);
				}
			}
			
		}, initialDelayMS, periodMS, TimeUnit.MILLISECONDS);
	}
	
	public static void shutdown(){
		executor.shutdownNow();
	}
}
