package boundless.exception;

public class AppException extends RuntimeException {

	private static final long serialVersionUID = 8376584928007165640L;

	protected String logDir = "error";
	protected String logfileName = "error";
	protected int command;

	public AppException() {
	}

	public AppException(String message) {
		super(message);
	}

	public AppException(Throwable cause) {
		super(cause);
	}

	public AppException(String message, Throwable cause) {
		super(message, cause);
	}

	public AppException(String message, Throwable cause, boolean enableSuppression, boolean writableStackTrace) {
		super(message, cause, enableSuppression, writableStackTrace);
	}

	public String getLogDir() {
		return logDir;
	}

	public String getLogfileName() {
		return logfileName;
	}

	public void setLogDir(String logDir) {
		this.logDir = logDir;
	}

	public void setLogfileName(String logfileName) {
		this.logfileName = logfileName;
	}

	public int getCommand() {
		return this.command;
	}
	
	public void setCommand(int cmd) {
		this.command = cmd;
	}
	
}
