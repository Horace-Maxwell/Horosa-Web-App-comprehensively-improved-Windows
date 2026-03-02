package boundless.log;

import java.util.Date;

import boundless.io.FileUtility;
import boundless.spring.help.PropertyPlaceholder;
import boundless.utility.DateTimeUtility;

public class DeleteOldLogsHelper {
	private static int days = PropertyPlaceholder.getProperty("deleteoldlogs.day", 30);
	
	public static void delete(String basedir, int deltaDay){
		Date limit = DateTimeUtility.getDateBefore(new Date(), deltaDay);
		long tm = limit.getTime();
		
		FileUtility.iterateFiles(basedir, (file)->{
			try{
				if(!file.exists()){
					return;
				}
				long ft = FileUtility.getLastModifyTime(file);
				if(ft < tm){
					file.delete();
				}
			}catch(Exception e){
				QueueLog.error(AppLoggers.ErrorLogger, e);
			}
		});
	}
	
	public static void delete(int deltaDay){
		String basedir = AppLoggers.getBaseDir();
		delete(basedir, deltaDay);
	}
	
	public static void delete(){
		String basedir = AppLoggers.getBaseDir();
		delete(basedir, days);
	}
	
	
}
