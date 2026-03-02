package boundless.log;

import java.util.HashMap;
import org.slf4j.LoggerFactory;

import boundless.utility.ConsoleUtility;
import boundless.utility.StringUtility;

/**
 * 日志接口，申明写日志和读日志的方法。线程安全
 * @author zjf
 *
 */
public abstract class Logger {
	public static org.slf4j.Logger globalLog = LoggerFactory.getLogger(Logger.class);
//	public static org.apache.logging.log4j.Logger globalLog = LogManager.getLogger(Logger.class);
	
	public static boolean isDebug = true;
	
	public static Logger logger = null;
	public static boolean displayMessage = true;
	
    public static final int DEBUG = 0;
    public static final int INFOR = 1;
    public static final int ERROR = 2;

    /**
     * 每天日志文件的数量
     */
    public static final String LOG_NUMBER = "LOG_NUMBER";
    
    /**
     * 每天日志文件的大小
     */
    public static final String LOG_SIZE = "LOG_SIZE";
    
    /**
     * 日志文件最大存放天数
     */
    public static final String LOG_DAYS = "LOG_DAYS";
    
    /**
     * 日志文件所在的目录
     */
    public static final String LOG_DIRECTORY = "LOG_DIRECTORY";
    
    /**
     * 每个日志文件的内容开头
     */
    public static final String LOG_HEADER = "LOG_HEADER";

	public Logger() {

	}

	/**
	 * 日志配置信息
	 */
    public HashMap logProperties = null; 

	/**
	 * 写日志到默认文件。
	 * @param message 日志信息
	 * @param msgType 日志类型
	 */
	public abstract void writeLog(String message, int msgType);

	/**
	 * 写日志
	 * @param message 日志信息
	 */
    public void writeLog(String message)
	{
		writeLog(message,INFOR);
	}

    /**
     * 写日志
     * @param format
     * @param args
     */
    public void writeLog(String format, Object[] args)
    {
        writeLog(String.format(format,args));
    }

    /**
     * 写日志
     * @param ex 异常信息
     */
    public void writeLog(Throwable ex)
	{
		writeLog(null,ex);
	}


    /**
     * 写日志
     * @param message 日志信息
     * @param ex 异常信息
     */
    public void writeLog(String message, Throwable ex){
		if (!StringUtility.isNullOrEmpty(message)){
			message+="\r\n";
		}
		StringBuilder sb = new StringBuilder(message);
		sb.append(ex.getMessage()).append("\r\n");
		sb.append(ConsoleUtility.getStackTrace(ex));
		writeLog(sb.toString(), ERROR);
	}

    /**
     * 关闭日志
     */
    public abstract void close();
    
    
    public static void println(String message){
		if(!displayMessage){
			return;
		}
		if(logger != null){
			logger.writeLog(message + "\r\n");
		}else {
			QueueLog.debug(globalLog, message);
		}
    }
    
}
