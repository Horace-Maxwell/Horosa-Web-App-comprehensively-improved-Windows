package boundless.exception;

public class ErrorCodeException extends AppException {
	private static final long serialVersionUID = 4708756688709972898L;
	
	protected int code = 9999;

	public ErrorCodeException() {
	}

	public ErrorCodeException(int code) {
		this.code = code;
		this.logfileName = code + "";
	}

	public ErrorCodeException(int code, String msg) {
		super(msg);
		this.code = code;
		this.logfileName = code + "";
	}
	 

	public ErrorCodeException(int code, String logdir, String logfilename) {
		this.code = code;
		this.logDir = logdir;
		this.logfileName = logfilename;
	}

	public ErrorCodeException(int code, String msg, String logdir, String logfilename) {
		super(msg);
		this.code = code;
		this.logDir = logdir;
		this.logfileName = logfilename;
	}

	public ErrorCodeException(int code, String msg, Throwable cause) {
		super(msg, cause);
		this.code = code;
		this.logfileName = code + "";
	}
	
	
	public ErrorCodeException(int code, Throwable cause, String logdir) {
		super(cause);
		this.code = code;
		this.logDir = logdir;
		this.logfileName = "errer";
	}
	
	public ErrorCodeException(int code, Throwable cause, String logdir, String logfilename) {
		super(cause);
		this.code = code;
		this.logDir = logdir;
		this.logfileName = logfilename;
	}
	

	public ErrorCodeException(String message) {
		super(message);
	}

	public ErrorCodeException(Throwable cause) {
		super(cause);
	}
	

	public ErrorCodeException(int code, Throwable cause) {
		super(cause);
		this.code = code;
		this.logfileName = code + "";
	}

	public ErrorCodeException(String message, Throwable cause) {
		super(message, cause);
	}

	public ErrorCodeException(String message, Throwable cause,
			boolean enableSuppression, boolean writableStackTrace) {
		super(message, cause, enableSuppression, writableStackTrace);
	}
	
	public int getCode(){
		return this.code;
	}


}
