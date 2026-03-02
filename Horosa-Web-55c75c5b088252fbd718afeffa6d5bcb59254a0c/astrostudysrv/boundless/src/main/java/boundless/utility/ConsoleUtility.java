package boundless.utility;

import java.text.MessageFormat;
import java.util.Date;

public class ConsoleUtility {

	public enum MessageType{
		/**
		 * 数据包
		 */
		PACKET(0), 
		
		/**
		 * 技能
		 */
		SPELL(1),
		
		/**
		 * 战斗
		 */
		COMBAT(2),
		
		/**
		 * AI
		 */
		AI(3),
		
		/**
		 * 异常
		 */
		EXCEPTION(4),
		
		/**
		 * 其他
		 */
		OTHER(5);
		
		private int _code;
		private MessageType(int code){
			this._code = code;
		}
		
		public int getCode(){
			return this._code;
		}
	}
	
	/**
	 * 输出消息
	 * @param msg
	 */
    public static void outMesssage(String msg)
    {
    	innerOutMessage("normal", msg);
    }
	
    /**
     * 输出消息
     * @param msg
     * @param args
     */
    public static void outMesssage(String msg, Object... args)
    {
    	innerOutMessage("normal", String.format(msg, args));
    }
	
    /**
     * 输出错误
     * @param msg
     */
    public static void outError(String msg)
    {
    	innerOutMessage("error", msg);
    }

    /**
     * 输出错误
     * @param msg
     * @param args
     */
    public static void outError(String msg, Object... args)
    {
    	innerOutMessage("error", String.format(msg, args));
    }
	
    /**
     * 输出成功
     * @param msg
     */
    public static void outSuccess(String msg)
    {
    	innerOutMessage("success", msg);
    }

    /**
     * 输出成功
     * @param msg
     * @param args
     */
    public static void outSuccess(String msg, Object... args)
    {
    	innerOutMessage("success", String.format(msg, args));
    }
	
    
    /**
     * 输出警告
     * @param msg
     */
    public static void outWarning(String msg)
    {
    	innerOutMessage("warning", msg);
    }

    /**
     * 输出警告
     * @param msg
     * @param args
     */
    public static void outWarning(String msg, Object... args)
    {
    	innerOutMessage("warning", MessageFormat.format(msg, args));
    }
    
    public static String getStackTrace(Throwable ex){
    	String msg = ex.getMessage();
    	StringBuilder sb = new StringBuilder();
    	sb.append(ex.toString()).append(",");
    	if(!StringUtility.isNullOrEmpty(msg)){
        	sb.append(msg);
    	}
    	sb.append("\r\n").append("StackTrack:").append("\r\n");
    	for(StackTraceElement elem :ex.getStackTrace()){
    		sb.append("\tat ").append(elem.toString()).append("\r\n");
    	}
    	
    	return sb.toString();
    }

    /**
     * 打印异常消息
     * @param ex
     */
    public static void printException(Throwable ex) {
        StringBuilder msg = new StringBuilder("\r\n");
        msg.append(MessageFormat.format("Exception:{0}\r\n", ex.getMessage()));
        msg.append("\r\n").append("StackTrack:").append("\r\n").append(getStackTrace(ex)).append("\r\n");

        innerOutMessage("exception", msg.toString());
    }

    
    private static void innerOutMessage(String msgtype, String msg)
    {
    	String curr = FormatUtility.formatDateTime(new Date(), "yyyy-MM-dd HH:mm:ss.S");
    	StringBuilder sb = new StringBuilder();
    	sb.append(curr).append(" ").append(msgtype).append(": ").append(msg);
    	System.out.println(sb.toString());
    }
    
    
    public static void main(String[] args){
    	outMesssage("test");
    	printException(new Exception("exception test"));
    }
}
