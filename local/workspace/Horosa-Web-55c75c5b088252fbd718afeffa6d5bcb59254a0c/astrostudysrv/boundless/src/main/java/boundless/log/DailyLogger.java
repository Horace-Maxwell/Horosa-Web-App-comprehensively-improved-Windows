package boundless.log;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileWriter;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.io.RandomAccessFile;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.BasicFileAttributes;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;

import boundless.io.FileUtility;

/**
 * 每日日志文件。每天一个日志文件, 日志文件会有个最大存放日期，超出日期会被删除.
 * @author zjf
 *
 */
public class DailyLogger extends Logger {
	/**
	 * 头前缀
	 */
    private static final String HEADER_PREFIX = "Date(d),Type(n),Thread(n)";

    private int _logFileDays = 10;				// 保存几天内的日志。
	private String _logDir = "/file/logs";		// 日志文件总保存位置
    private String _header = HEADER_PREFIX+",Content";

    private Date _lastCleanTime;

    public DailyLogger() {

	}

    public DailyLogger(String logDirectory)
    {
        HashMap props = new HashMap();
        props.put(LOG_DIRECTORY, logDirectory);
        initialize(props);
    }

    private void initialize(HashMap properties)
    {
        try
        {
            _logFileDays = Integer.valueOf(properties.get(Logger.LOG_DAYS).toString().trim());// 日志保存天数定义
        }
        catch(Exception e) { }
        
        if (properties.get(Logger.LOG_DIRECTORY) != null)
        {
            _logDir = properties.get(Logger.LOG_DIRECTORY).toString().trim();
        }
        if (properties.get(Logger.LOG_HEADER) != null)
        {
            _header = HEADER_PREFIX + "," + properties.get(Logger.LOG_HEADER).toString().trim();
        }
    }

    public String getLogDir(){
    	return this._logDir;
    }
    
    public void setLogDir(String dir) {
    	this._logDir = dir;
    }

    /**
     * 保证文件目录要存在
     */
	private void makesureDirectoryExist()
	{
		// 创建日志保存总目录
		try {
            createDirectory(_logDir);
             // 初始化时，删除多余的目录
            cleanFiles();
        }
		catch (Exception exp){
        }
	}

	
	@Override
	public void writeLog(String message, int msgType) {
		QueueLog.queueWorkItem(()->{
            writeLogToFile(message, msgType);
		});
	}

	synchronized private void writeLogToFile(String message, int msgType)
	{
        makesureDirectoryExist();

        PrintWriter pw = null;
        try
        {
        	SimpleDateFormat df = new SimpleDateFormat("yyyyMMdd");
        	String datestr = df.format(new Date());
            String fileName = FileUtility.combinePath(_logDir, datestr + ".log"); 
            
            FileOutputStream fos = new FileOutputStream(new File(fileName), true);
            pw = new PrintWriter(new BufferedWriter(new OutputStreamWriter(fos, "UTF-8")));
            pw.println(formatMessage(message, msgType));
            pw.println();
            pw.flush();
        }catch(Exception e){
        	
        } finally {
        	if(pw  != null){
				pw.close();
        	}
        }
	}

    private String formatMessage(String message, int MsgType)
    {
    	SimpleDateFormat df = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss:S");
    	String res = df.format(new Date()) + "," + MsgType + "," + 
    			Thread.currentThread().getId() + "," + message;
    	return res;
    }

    /**
     * 在当前文件夹下面创建此目录
     * @param directory
     * @return
     */
	private boolean createDirectory(String directory)
	{
		try
		{
			File file = new File(directory);
			if(file.isDirectory()){
				return true;
			}
			
			return file.mkdirs();
		}
		catch(Exception ex)
		{
			throw new RuntimeException("创建日志文件夹失败！" + ex.getMessage());
		}
	}

	/**
	 * 当文件夹目录超过一定天数时，删除文件夹目录。
	 */
	private void cleanFiles()
	{
		Calendar cal = Calendar.getInstance();
		int currday = cal.get(Calendar.DAY_OF_YEAR);
		cal.setTime(_lastCleanTime);
		if(currday == cal.get(Calendar.DAY_OF_YEAR)){
			return;
		}
		
		File dir = new File(_logDir);
		if(!dir.exists()){
			return;
		}

        _lastCleanTime = new Date();
		cal = Calendar.getInstance();
		cal.add(Calendar.DATE, - this._logFileDays);
        
		for (File logfile : dir.listFiles())
		{
			try
			{
				Path path = Paths.get(logfile.getAbsolutePath());
				BasicFileAttributes baseattr = Files.readAttributes(path, BasicFileAttributes.class);
				if(baseattr.creationTime().toMillis() < cal.getTimeInMillis())
				{
					if(logfile.isFile())
						Files.delete(path);
				}
			}
			catch(Exception ex)
			{
                System.out.println("删除日志文件失败! " + ex.getMessage());
                ex.printStackTrace();
			}
		}
	}
    
	@Override
	public void close() {

	}

	
	public static void main(String[] args){
		DailyLogger log = new DailyLogger();
		log.writeLog("log test");
	}
	
}
