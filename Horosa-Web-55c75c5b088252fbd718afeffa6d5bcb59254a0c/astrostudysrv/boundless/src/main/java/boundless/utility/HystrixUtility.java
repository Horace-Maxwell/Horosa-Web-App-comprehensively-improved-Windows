package boundless.utility;

import java.util.concurrent.TimeUnit;

import com.netflix.hystrix.Hystrix;
import com.netflix.hystrix.HystrixCommand;
import com.netflix.hystrix.HystrixCommandGroupKey;
import com.netflix.hystrix.util.HystrixTimer;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.spring.help.PropertyPlaceholder;
import boundless.types.ExecutionGroup;
import rx.Observable;
import rx.schedulers.Schedulers;

public class HystrixUtility {
	private static boolean needHystrix = PropertyPlaceholder.getPropertyAsBool("needhystrix", false);
	private static ExecutionGroup executor = new ExecutionGroup(1, "HystrixUtility");
	
	public static void execute(String name, long timeoutMS, Runnable handler){
		if(!needHystrix){
			executor.execute(()->{
				handler.run();
			}, (e)->{
				QueueLog.error(AppLoggers.ErrorLogger, e);
			});
			return;
		}
		
		SimpleHystrixCommand cmd = new SimpleHystrixCommand(name, handler);
		Observable<Integer> ob = cmd.observe();
		ob.timeout(timeoutMS, TimeUnit.MILLISECONDS);
		ob.subscribe((v)->{
			handler.run();
		}, (e)->{
			QueueLog.error(AppLoggers.ErrorLogger, e);
		});
	}

	public static void execute(String name, Runnable handler){
		if(!needHystrix){
			executor.execute(()->{
				handler.run();
			}, (e)->{
				QueueLog.error(AppLoggers.ErrorLogger, e);
			});
			return;
		}
		
		SimpleHystrixCommand cmd = new SimpleHystrixCommand(name, handler);
		Observable<Integer> ob = cmd.observe();
		ob.subscribe((v)->{
			handler.run();
		}, (e)->{
			QueueLog.error(AppLoggers.ErrorLogger, e);
		});
	}

	public static void shutdown(){
		try{
			HystrixTimer.reset();
		}catch(Exception e){
		}
		try{
			Hystrix.reset(1, TimeUnit.MILLISECONDS);
		}catch(Exception e){
		}
		executor.close();
	}

	public static class SimpleHystrixCommand extends HystrixCommand<Integer>{
		private Runnable handler;
		
		public SimpleHystrixCommand(String groupName, Runnable handler){
			super(HystrixCommandGroupKey.Factory.asKey(groupName));
		}
		
		@Override
		protected Integer run() throws Exception {
			this.handler.run();
			return 0;
		}
		
		@Override  
	    protected Integer getFallback() { 
	        return -1;  
	    }  

	}
}
