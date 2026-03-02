package boundless.console;

import it.sauronsoftware.cron4j.Scheduler;

public class RebootCronTask {
	
	private static Scheduler cronReboot = new Scheduler(); 
	
	public static void start(String pattern){
		if(cronReboot.isStarted()){
			cronReboot.stop();
		}
		
		cronReboot.schedule(pattern, ()->{
			ApplicationUtility.reboot();
		});
		
		cronReboot.start();
	}
	

	public static void shutdown(){
		if(cronReboot != null && cronReboot.isStarted()){
			cronReboot.stop();
		}
	}

}
