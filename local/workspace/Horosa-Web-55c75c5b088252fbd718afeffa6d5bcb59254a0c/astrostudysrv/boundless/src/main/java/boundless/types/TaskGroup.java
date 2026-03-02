package boundless.types;

import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ForkJoinPool;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;

public class TaskGroup {
	private static ExecutorService executor;

	static{
		executor = new ForkJoinPool(2, ForkJoinPool.defaultForkJoinWorkerThreadFactory, null, true);
	}
	
	public static TaskGroup create(){
		return new TaskGroup();
	}
	
	private Set<InnerTask> tasks;
	
	TaskGroup(){
		tasks = new HashSet<InnerTask>();
	}
	
	public void addTask(Runnable handle){
		InnerTask task = new InnerTask();
		task.handle = handle;
		
		synchronized(tasks){
			tasks.add(task);
		}
		
		executor.execute(()->{
			task.handle.run();
			synchronized(tasks){
				tasks.remove(task);
				tasks.notifyAll();
			}
		});
	}
	
	public void awaitTermination(){
		synchronized(tasks){
			while(!tasks.isEmpty()){
				try {
					tasks.wait(1000);
				} catch (InterruptedException e) {
					QueueLog.error(AppLoggers.ErrorLogger, e);
				}
			}
			
		}
	}
	
	public int countTask(){
		return this.tasks.size();
	}
	
	private static class InnerTask{
		Runnable handle;
	}
	
}
