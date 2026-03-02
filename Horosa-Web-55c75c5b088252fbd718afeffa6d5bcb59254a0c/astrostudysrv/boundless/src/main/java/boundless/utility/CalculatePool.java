package boundless.utility;

import java.util.function.Consumer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import boundless.types.ExecutionGroup;


/**
 * 计算池
 * @author zjf
 *
 */
public class CalculatePool {
	private static Logger log = LoggerFactory.getLogger(CalculatePool.class);
	
	private static ExecutionGroup executor = new ExecutionGroup(64, "CalculatePool");

	/**
	 * 放入计算池里执行
	 * @param callBack 要执行的逻辑方法
	 * @param exHandler 当错误时回调的处理方法
	 */
    public static void queueUserWorkItem(Runnable callBack,Consumer<Throwable> exHandler)
    {
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

    public static void queueUserWorkItem(Runnable callBack)
    {
    	executor.execute(()->{
    		try{
    			if(callBack != null){
    				callBack.run();
    			}
    		}catch(Throwable e){
    			log.error(ConsoleUtility.getStackTrace(e));
    		}
    	});
    }

	/**
	 * 放入计算池里执行
	 * @param param callBack的参数
	 * @param callBack 要执行的逻辑方法
	 * @param exHandler 当错误时回调的处理方法
	 */
    public static void queueUserWorkItem(Object param, Consumer<Object> callBack,Consumer<Throwable> exHandler)
    {
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
    
    public static int countRunning() {
    	return executor.countRunning();
    }

	public static void shutdown(){
		executor.close();
	}
	
}
