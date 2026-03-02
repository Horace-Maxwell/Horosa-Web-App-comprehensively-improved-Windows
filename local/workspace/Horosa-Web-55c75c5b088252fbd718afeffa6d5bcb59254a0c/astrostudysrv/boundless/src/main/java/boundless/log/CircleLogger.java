package boundless.log;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.BasicFileAttributes;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.Timer;
import java.util.TimerTask;

import boundless.io.FileUtility;

/**
 * 循环写入日志文件。每天一个日志文件夹，每个文件夹多个日志文件，等1个文件满了，写到下一个文件，如果都满了覆盖第1个文件后再从第1个文件开始写。
 * 日志文件会有个最大存放日期，超出日期会被删除。
 * @author zjf
 *
 */
public class CircleLogger extends Logger {
	private Timer _flushTimer;
	/**
	 * 头前缀
	 */
	private static String HEADER_PREFIX = "Date(d),Type(n),Thread(n)";

    private long _fileMaxSize = 1024 * 1024;			// 文件大小超过此数，则创建新的文件
    private int _logFileDays = 10;				// 保存几天内的日志。
    private int _fileNum = 3;			// 日志文件循环保存的文件名
	private String _logDir = "/file/logs";		// 日志文件总保存位置
    private String _header = HEADER_PREFIX+",Content";
    private String _currentFileName;
	
	//保存当日志文件都大于极限时，清空哪一个日志文件的索引
	private int _logFileIndex=0;
    private LogFileWritter _currentWritter;

    private Date _lastCleanTime;
	
	public CircleLogger(String logDirectory) {
        HashMap props = new HashMap();
        props.put(LOG_DIRECTORY, logDirectory);
        initialize(props);
	}

    public CircleLogger(HashMap properties)
	{
        initialize(properties);
	}

    private void initialize(HashMap properties)
    {
        if (properties != null)
        {
            try
            {
                _fileNum = Integer.valueOf(properties.get(Logger.LOG_NUMBER).toString().trim());		// 日志文件大小定义
            }
            catch(Exception e) { }
            try
            {
                _fileMaxSize = 1024 * Integer.valueOf(properties.get(Logger.LOG_SIZE).toString().trim());			// 日志文件容量定义
            }
            catch(Exception e) { }
            try
            {
                _logFileDays = Integer.valueOf(properties.get(Logger.LOG_DAYS).toString().trim());		// 日志保存天数定义
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

        // 初始化时，删除多余的目录
        try
        {
            deleteDirectorys(_logFileDays);
        }
        catch (Exception ex) { }

        TimerTask task = new TimerTask(){
			@Override
			public void run() {
				synchronized(this){
	                try
	                {
	                    if (_currentWritter != null) _currentWritter.flush();
	                }
	                catch (Exception ex) { }					
				}
			}        	
        };
        
        _flushTimer = new Timer();        
        _flushTimer.schedule(task, 2000, 2000);
    }

	private void makesureDirectoryExist()
	{
		SimpleDateFormat df = new SimpleDateFormat("yyyy-MM-dd");
        String planFileName = df.format(new Date());
        if (_currentFileName!=null && _currentFileName.equals(planFileName)) return;

        _currentFileName = planFileName;
        String temp = FileUtility.combinePath(_logDir, _currentFileName);
		// 创建日志保存总目录
		try {
			createDirectory(temp);
             // 初始化时，删除多余的目录
            deleteDirectorys(_logFileDays);
        }
		catch (Exception exp){
	
        }
        if (_currentWritter != null)
        {
            _currentWritter.close();
            _currentWritter = null;
        }
	}
    
	
	@Override
	public void writeLog(String message, int msgType) {
		QueueLog.queueWorkItem(()->{
            writeLogToFile(message, msgType);
		});
	}

	@Override
	public void close() {
        if (_currentWritter != null) {
            _currentWritter.close();
        }

        _flushTimer.cancel();
	}

	/**
	 * 向默认文件中写入日志
	 * @param message
	 * @param msgType
	 */
    synchronized private void writeLogToFile(String message, int msgType)
	{
        makesureDirectoryExist();

        if (_currentWritter != null && !_currentWritter.isFull())
        {
            _currentWritter.writeLine(formatMessage(message,msgType));
            return;
        }

        if (_currentWritter != null){
        	_currentWritter.close();
        }
        
        String logPath = FileUtility.combinePath(_logDir, _currentFileName, _logFileIndex + ".log") ;
        if (_currentWritter == null)
        {
            _logFileIndex = 0;
            while (_logFileIndex < _fileNum)
            {
                File myFileInfo = new File(logPath);
                if (!myFileInfo.exists() || myFileInfo.length() < _fileMaxSize){
                	break;
                }
                
                _logFileIndex++;
            }
        }
        else
        {
            _logFileIndex++;
        }
        
        if (_logFileIndex >= _fileNum) _logFileIndex = 0;

        _currentWritter = new LogFileWritter(this, logPath);
        
        if (_currentWritter.isEmpty()) 
        	_currentWritter.writeLine(_header);
        
        _currentWritter.writeLine(formatMessage(message, msgType));
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
	 * @param logFileDays
	 */
	private void deleteDirectorys(int logFileDays)
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
					if(logfile.isDirectory()){
						FileUtility.deleteDirectory(logfile);
					}
				}
			}
			catch(Exception ex)
			{
                System.out.println("删除日志文件失败! " + ex.getMessage());
                ex.printStackTrace();
			}
		}
	}
	

	/**
	 * 判断时间是否在一定范围内
	 * @param source 被比较的时间
	 * @param from 比较起始时间
	 * @param to 比较结束时间
	 * @return
	 */
	private boolean judge(Date source, Date from, Date to)
	{
		boolean result = false;
		if (from.getTime() < source.getTime() && source.getTime() < to.getTime())
			result = true;
		return result;
	}


    private class LogFileWritter
    {
        private CircleLogger _logger;
        private PrintWriter _sw;
        private long _fileSize;
        private boolean _closed = false;

        public LogFileWritter(CircleLogger logger,String file)
        {
            this._logger = logger;
            File myFileInfo = new File(file);
            _fileSize = myFileInfo.exists() ? myFileInfo.length() : 0;
            
            FileOutputStream fos = null;
            try{
                if (isFull()) {
                	fos = new FileOutputStream(new File(file), false);
                    _fileSize = 0;
                }else{
                	fos = new FileOutputStream(new File(file), true);
                }
                _sw = new PrintWriter(new BufferedWriter(new OutputStreamWriter(fos, "UTF-8")));
            }catch(Exception e){
            	
            }

        }

        public void writeLine(String text)
        {
            _sw.println(text);
            _fileSize += text.length();
        }

        public void close()
        {
            _closed = true;
            _sw.close();
        }

        public boolean isEmpty()
        {
            return _fileSize == 0;
        }

        public boolean isFull()
        {
            return _fileSize >= _logger._fileMaxSize;
        }

        public void flush()
        {
            if (_closed) return;
            _sw.flush();
        }
    }
	
    
    public static void main(String[] args){
    	CircleLogger log = new CircleLogger(new HashMap());
    	log.writeLog("test test test test test test test test test test test test test test test test test test test test test test test test test test test test");
    	log.writeLog("test test test test test test test test test test test test test test test test test test test test test test test test test test test test");
    	log.writeLog("test test test test test test test test test test test test test test test test test test test test test test test test test test test test");
    	log.writeLog("test test test test test test test test test test test test test test test test test test test test test test test test test test test test");
    	log.writeLog("test test test test test test test test test test test test test test test test test test test test test test test test test test test test");
    	log.writeLog("test test test test test test test test test test test test test test test test test test test test test test test test test test test test");
    	log.writeLog("test test test test test test test test test test test test test test test test test test test test test test test test test test test test");
    	log.writeLog("test test test test test test test test test test test test test test test test test test test test test test test test test test test test");
    	log.writeLog("test test test test test test test test test test test test test test test test test test test test test test test test test test test test");
    	log.writeLog("test test test test test test test test test test test test test test test test test test test test test test test test test test test test");
    }
    
}
