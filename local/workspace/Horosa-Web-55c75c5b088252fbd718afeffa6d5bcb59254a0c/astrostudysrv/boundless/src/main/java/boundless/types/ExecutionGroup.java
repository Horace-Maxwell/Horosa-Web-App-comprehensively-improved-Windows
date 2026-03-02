package boundless.types;

import java.lang.management.ManagementFactory;
import java.util.Date;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;

import javax.management.MBeanServer;
import javax.management.ObjectName;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.utility.FormatUtility;
import boundless.utility.StringUtility;

/**
 * 
 * @author zjf
 *
 */
public class ExecutionGroup implements ExecutionGroupMXBean{

	private static MBeanServer mbs = ManagementFactory.getPlatformMBeanServer(); 

	public static void registerMBean(ExecutionGroup executor, ObjectName mxbeanName){
		try{
			mbs.registerMBean(executor, mxbeanName);
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}

	public static void unregisterMBean(ObjectName mxbeanName){
		try{
			mbs.unregisterMBean(mxbeanName);
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}


	private ExecutorService executor;

	private int runningCounter = 0;
	private Runnable groupEmptyHandle;

	private boolean waitWhenFull = false;
	private int taskThreshold = 0;
	private int size;
	private ExeGroupThreadFactory threadFactory;

	public ExecutionGroup(){
		this(32, new ExeGroupThreadFactory(null));
	}
	
	public ExecutionGroup(int size){
		this(size, new ExeGroupThreadFactory(null));
	}

	public ExecutionGroup(int size, String threadfactoryName){
		this(size, new ExeGroupThreadFactory(threadfactoryName));
	}

	public ExecutionGroup(int size, ExeGroupThreadFactory factory){
		this(size, false, factory);
	}

	/**
	 * 
	 * @param size
	 * @param waitWhenFull 当等于true时，若正在执行的线程数大于size，方法execute不会返回，会一直等待线程数小于size后，才把新的线程放入线程池，然后才返回；
	 * 当为false时，直接把新线程放入线程池，马上返回，不会去考虑线程池是否已满
	 */
	public ExecutionGroup(int size, boolean waitWhenFull, int taskThreshold, ExeGroupThreadFactory factory){
		this.size = size;
		this.threadFactory = factory;
		if(size == 1) {
			this.executor = new ThreadPoolExecutor(1, 1,
		            0L, TimeUnit.MILLISECONDS,
		            new LinkedBlockingQueue<Runnable>(),
		            this.threadFactory);
		}else {
			this.executor = new ThreadPoolExecutor(size, size,
	                0L, TimeUnit.MILLISECONDS,
	                new SynchronousQueue<Runnable>(),
	                this.threadFactory);			
		}
		
		this.waitWhenFull = waitWhenFull;
		this.taskThreshold = taskThreshold;
	}

	public ExecutionGroup(int size, boolean waitWhenFull, String threadfactoryName){
		this(size, waitWhenFull, 0, new ExeGroupThreadFactory(threadfactoryName));
	}

	public ExecutionGroup(int size, boolean waitWhenFull, ExeGroupThreadFactory factory){
		this(size, waitWhenFull, 0, factory);
	}

	public void setGroupName(String name){
		this.threadFactory.setName(name);
	}

	public void setWaitWhenFull(boolean value){
		this.waitWhenFull = value;
	}

	public void setTaskThreshold(int value){
		if(value < 0){
			return;
		}
		this.taskThreshold = value;
	}

	public int countRunning(){
		return this.runningCounter;
	}

	@Override
	public int getRunning(){
		return this.runningCounter;
	}

	public boolean isEmpty(){
		return this.runningCounter == 0;
	}

	public void registerFinishAllRunningHandler(Runnable handler){
		groupEmptyHandle = handler;
	}

	public void execute(Runnable task, Consumer<Throwable> exceptHandle){
		try{
			while(this.waitWhenFull && this.runningCounter >= this.size){
				try{
					Thread.sleep(1000);
				}catch(Exception e){
					QueueLog.error(AppLoggers.ErrorLogger, e.getMessage());
				}
			}
			if(this.taskThreshold > 0 && this.runningCounter > this.taskThreshold){
				QueueLog.warn(AppLoggers.Performance, "pool size is {}, taskThreshold:{}, but there are {} running task, so reject this task", 
						this.size, this.taskThreshold, this.runningCounter);
				return;
			}
			synchronized(this){
				this.runningCounter++;
			}
			if(task != null){
				executor.execute(()->{
					try{
						task.run();
					}catch(Throwable e){
						if(exceptHandle != null){
							exceptHandle.accept(e);
						}else{
							QueueLog.error(AppLoggers.ErrorLogger, e);
						}
					}finally{
						synchronized(this){
							this.runningCounter--;
							if(this.runningCounter == 0 && this.groupEmptyHandle != null){
								try{
									this.groupEmptyHandle.run();
								}catch(Throwable e){
									if(exceptHandle != null){
										try{
											exceptHandle.accept(e);
										}catch(Exception er){
											QueueLog.error(AppLoggers.ErrorLogger, er);
										}
									}else{
										QueueLog.error(AppLoggers.ErrorLogger, e);
									}
								}
							}
						}
					}
				});
			}
		}catch(Exception e){
			if(exceptHandle != null){
				exceptHandle.accept(e);
			}else{
				QueueLog.error(AppLoggers.ErrorLogger, e);
			}
		}
	}

	public void execute(Runnable task){
		execute(task, null);
	}
	
	public void waitAllFinish(){
		while(!isEmpty()){
			try {
				Thread.sleep(1000);
			} catch (Exception e) {
				throw new RuntimeException(e);
			}
		}
	}

	public void waitAllFinish(long sleepMS){
		long ms = sleepMS <= 0 ? 1000 : sleepMS;
		while(!isEmpty()){
			try {
				Thread.sleep(ms);
			} catch (Exception e) {
				throw new RuntimeException(e);
			}
		}
	}

	public void close(){
		if(this.executor == null){
			return;
		}
		try{
			this.executor.shutdownNow();
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
		this.executor = null;
	}

	/**
	 * 
	 * @author zjf
	 *
	 */
	public static class ExeGroupThreadFactory implements ThreadFactory{
		private static final AtomicInteger poolNumber = new AtomicInteger(1);
		private final ThreadGroup group;
		private final AtomicInteger threadNumber = new AtomicInteger(1);
		private final String namePrefix;
		private String egName;
		
		public ExeGroupThreadFactory(String eg){
			this.egName = eg;
			SecurityManager s = System.getSecurityManager();
			group = (s != null) ? s.getThreadGroup() :
				Thread.currentThread().getThreadGroup();
			namePrefix = poolNumber.getAndIncrement() + "-thread";
		}
		
		public void setName(String name){
			this.egName = name;
		}

		@Override
		public Thread newThread(Runnable r) {
			String tm = FormatUtility.formatDateTime(new Date(), "yyyyMMddHHmmss.S");
			String gn = StringUtility.isNullOrEmpty(this.egName) ? "ExecutionGroup" : this.egName;
			String tn = String.format("bdl-%s-%s-%d-%s", gn, namePrefix, threadNumber.getAndIncrement(), tm);
			Thread t = new Thread(group, r, tn, 0);
			if (t.isDaemon()) {
				t.setDaemon(false);
			}
			if (t.getPriority() != Thread.NORM_PRIORITY) {
				t.setPriority(Thread.NORM_PRIORITY);
			}
			return t;
		}

	}
}
