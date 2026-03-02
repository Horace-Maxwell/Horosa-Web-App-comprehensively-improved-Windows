package boundless.utility;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.types.ExecutionGroup.ExeGroupThreadFactory;

/**
 * 计算池
 * @author zjf
 *
 */
public class SerialCalculatePool {
	private static ExeGroupThreadFactory factory = new ExeGroupThreadFactory("SerialCalculatePool");
	private static ExecutorService executor = new ThreadPoolExecutor(1, 1,
            0L, TimeUnit.MILLISECONDS,
            new LinkedBlockingQueue<Runnable>(),
            factory);

    public static void queueUserWorkItem(Runnable callBack){
    	executor.execute(()->{
    		try{
    			if(callBack != null){
    				callBack.run();
    			}
    		}catch(Throwable e){
    			QueueLog.error(AppLoggers.ErrorLogger, e);
    		}
    	});
    }
	
	/**
	 * 放入计算池里执行
	 * @param callBack 要执行的逻辑方法
	 * @param exHandler 当错误时回调的处理方法
	 */
    public static void queueUserWorkItem(Runnable callBack,Consumer<Throwable> exHandler){
    	executor.execute(()->{
    		try{
    			if(callBack != null){
    				callBack.run();
    			}
    		}catch(Throwable e){
    			if(exHandler != null){
        			exHandler.accept(e);
    			}
    		}
    	});
    }

	/**
	 * 放入计算池里执行
	 * @param param callBack的参数
	 * @param callBack 要执行的逻辑方法
	 * @param exHandler 当错误时回调的处理方法
	 */
    public static void queueUserWorkItem(Object param, Consumer<Object> callBack,Consumer<Throwable> exHandler){
    	executor.execute(()->{
    		try{
    			if(callBack != null){
    				callBack.accept(param);
    			}
    		}catch(Throwable e){
    			if(exHandler != null){
        			exHandler.accept(e);
    			}
    		}
    	});
    }
    
	public static void shutdown(){
		executor.shutdownNow();
	}
	
    public static void main(String[] args){
    	for(int i=0; i<10; i++){
    		Integer cnt = new Integer(i);
    		SerialCalculatePool.queueUserWorkItem(cnt, (obj)->{
    			System.out.println("thread-" + obj);
    		}, (e)->{
    			System.out.println(e.getMessage());
    		});
    	}
    }

}
