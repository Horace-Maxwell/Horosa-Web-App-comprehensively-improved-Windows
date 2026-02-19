package boundless.log;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Consumer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import boundless.io.CompressUtility;
import boundless.security.SecurityUtility;
import boundless.types.ExecutionGroup;
import boundless.utility.ConsoleUtility;
import boundless.utility.FormatUtility;
import boundless.utility.StringUtility;

public class QueueLog {
	private static Consumer<Map<String, Object>> sendCenterHandler = null;

	
	public static org.slf4j.Logger globalLog = LoggerFactory.getLogger(QueueLog.class);
//	public static Logger globalLog = LogManager.getLogger(QueueLog.class);
	
	private static ExecutionGroup executor = new ExecutionGroup(64, "QueueLog");
	private static ExecutionGroup sendHandlerExecutor = new ExecutionGroup(64, "SendCenterHandlerExecutor");
	
    public static void queueWorkItem(Runnable callBack,Consumer<Throwable> exHandler){
    	if(executor == null){
    		return;
    	}
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
    
    private static String processLog(String format, Thread threadobj){
    	int idx = -1;
    	Thread thread = threadobj;
    	if(thread == null) {
			thread = Thread.currentThread();
    	}
    	StackTraceElement[] currStack = thread.getStackTrace();
    	for(int i=0; i<currStack.length; i++){
    		StackTraceElement elem = currStack[i];
    		String classname = elem.getClassName();
    		if(classname.contains("QueueLog")){
    			idx = i;
    		}else{
    			if(idx > -1){
    				idx = i;
    				break;
    			}
    		}
    	}
    	if(idx == -1){
    		return format;
    	}
    	
    	StackTraceElement topelem = currStack[idx];
    	StringBuilder sb = new StringBuilder();
    	if(StringUtility.isNullOrEmpty(format)){
    		sb.append("");
    	}else{
    		sb.append(format);
    	}
    	sb.append(" \t(").append(topelem.getClassName()).append(".").append(topelem.getMethodName()).append(":");
    	sb.append(topelem.getLineNumber()).append(")");
    	
    	return sb.toString();
    }
    
    public static void queueWorkItem(Runnable callBack){
    	executor.execute(()->{
    		try{
    			if(callBack != null){
    				callBack.run();
    			}
    		}catch(Throwable e){
    			globalLog.error(ConsoleUtility.getStackTrace(e));
    		}
    	});
    }
    
    public static void info(Logger log, String format, Object... arguments){
    	if(log == null) return;
    	String fmt = processLog(format, null);
    	QueueLog.queueWorkItem(()->{
        	log.info(fmt, arguments);
        	sendToCenter(log, "info", format, arguments);
		});
    }

    public static void info(Logger log, String format){
    	if(log == null) return;
    	String fmt = processLog(format, null);
		QueueLog.queueWorkItem(()->{
        	log.info(fmt);
        	sendToCenter(log, "info", format);
		});
    }

    public static void debug(Logger log, String format, Object... arguments){
    	if(log == null) return;
    	String fmt = processLog(format, null);
		QueueLog.queueWorkItem(()->{
			log.debug(fmt, arguments);
        	sendToCenter(log, "debug", format, arguments);
		});
    }

    public static void debug(Logger log, String format){
    	if(log == null) return;
    	String fmt = processLog(format, null);
		QueueLog.queueWorkItem(()->{
        	log.debug(fmt);
        	sendToCenter(log, "debug", format);
		});
    }

    public static void error(Logger log, String format, Object... arguments){
    	if(log == null) return;
		QueueLog.queueWorkItem(()->{
        	log.error(format, arguments);
        	sendToCenter(log, "error", format, arguments);
		});
    }

    public static void error(Logger log, String format){
    	if(log == null) return;
		QueueLog.queueWorkItem(()->{
        	log.error(format);
        	sendToCenter(log, "error", format);
		});
    }
    
    

    public static void error(Logger log, Throwable e){
    	if(log == null) return;
		QueueLog.queueWorkItem(()->{
			String msg = ConsoleUtility.getStackTrace(e);
        	log.error(msg);
        	sendToCenter(log, "error", msg);
		});
    }

    public static void error(Logger log, Throwable e, String attach){
    	if(log == null) return;
		QueueLog.queueWorkItem(()->{
			StringBuilder sb = new StringBuilder(attach);
			sb.append("  ").append(ConsoleUtility.getStackTrace(e));
			String msg = sb.toString();
        	log.error(msg);
        	sendToCenter(log, "error", msg);
		});
    }

    public static void warn(Logger log, String format, Object... arguments){
    	if(log == null) return;
    	String fmt = processLog(format, null);
		QueueLog.queueWorkItem(()->{
        	log.warn(fmt, arguments);
        	sendToCenter(log, "warn", format);
		});
    }

    public static void warn(Logger log, String format){
    	if(log == null) return;
    	String fmt = processLog(format, null);
		QueueLog.queueWorkItem(()->{
        	log.warn(fmt);
        	sendToCenter(log, "warn", format);
		});
    }

    public static void trace(Logger log, String format, Object... arguments){
    	if(log == null) return;
    	String fmt = processLog(format, null);
 		QueueLog.queueWorkItem(()->{
        	log.trace(fmt, arguments);
        	sendToCenter(log, "trace", format, arguments);
		});
    }

    public static void trace(Logger log, String format){
    	if(log == null) return;
    	String fmt = processLog(format, null);
		QueueLog.queueWorkItem(()->{
        	log.trace(fmt);
        	sendToCenter(log, "trace", format);
		});
    }
    
    public static String getMsg(String format, Object... arguments) {
    	if(arguments == null || arguments.length == 0) {
    		return format;
    	}
    	String[] parts = format.split("\\{\\}");
    	if(parts.length == 0) {
    		return arguments[0].toString();
    	}
    	StringBuilder sb = new StringBuilder();
    	if(parts.length <= arguments.length) {
        	for(int i=0; i<parts.length; i++) {
        		sb.append(parts[i]).append(arguments[i]);
        	}    		
    	}else {
        	for(int i=0; i<arguments.length; i++) {
        		sb.append(parts[i]).append(arguments[i]);
        	}    		
    		for(int i=arguments.length; i<parts.length; i++) {
    			sb.append(parts[i]).append("{}");
    		}
    	}
    	return sb.toString();
    }
    
    public static String encodeMsg(String msg) {
    	byte[] raw = CompressUtility.compressToBytes(msg);
    	String res = SecurityUtility.base64(raw);
    	return res;
    }
    
    public static String decodeMsg(String cypher) {
    	try {
    		byte[] raw = SecurityUtility.fromBase64(cypher);
    		String msg = CompressUtility.decompressFromBytes(raw);
    		return msg;    		
    	}catch(Exception e) {
    		throw new RuntimeException(e);
    	}
    }
    
    private static void sendToCenter(Logger log, String level, String format, Object... arguments) {
    	if(sendCenterHandler == null) {
    		return;
    	}
    	
    	sendHandlerExecutor.execute(()->{
        	try {
            	String msg = getMsg(format, arguments);
            	msg = encodeMsg(msg);
            	Map<String, Object> map = new HashMap<String, Object>();
        		long tm = System.currentTimeMillis();
        		Date dt = FormatUtility.parseDateTime(tm);
        		String tmstr = FormatUtility.formatDateTime(dt, "yyyy-MM-dd HH:mm:ss");
        		map.put("tm", tm);
        		map.put("time", tmstr);
            	map.put("Name", log.getName());
            	map.put("Level", level);
            	map.put("Log", msg);
            	sendCenterHandler.accept(map);
        	}catch(Exception e) {
        		e.printStackTrace();
        	}    		
    	});
    }
    
    public static void setSendCenterHandler(Consumer<Map<String, Object>> handler) {
    	sendCenterHandler = handler;
    }
    
    public static void build(){
    	if(executor != null){
    		executor.close();
    	}
    	executor = new ExecutionGroup(64, "QueueLog");
    	
    	if(sendHandlerExecutor != null) {
    		sendHandlerExecutor.close();
    	}
    	sendHandlerExecutor = new ExecutionGroup(64, "SendCenterHandlerExecutor");
    }
    
    public static void shutdown(){
    	try {
        	executor.close();
        	executor = null;    		
    	}catch(Exception e) {
    	}
    	
    	try {
        	sendHandlerExecutor.close();
        	sendHandlerExecutor = null;
    	}catch(Exception e) {
    	}
    }
    
    public static void main(String[] args) {
    	String format = "test is a test, {}={}";
    	String msg = getMsg(format);
    	System.out.println(msg);
    }

}
