package boundless.exception;

public class AccessDenyException extends ErrorCodeException {
	private static final long serialVersionUID = 8883698128013803979L;
	public static final int AccessDenyErrorCode = 900;
	public static final String AccessDenyMsg = "data.auth.fail";

	public AccessDenyException() {
		super(AccessDenyErrorCode, AccessDenyMsg);
	}

	public AccessDenyException(String msg) {
		super(AccessDenyErrorCode, msg);
	}

	public AccessDenyException(String logdir, String logfilename) {
		super(AccessDenyErrorCode, AccessDenyMsg, logdir, logfilename);
	}

	public AccessDenyException(String msg, String logdir, String logfilename) {
		super(AccessDenyErrorCode, msg, logdir, logfilename);
	}

	public AccessDenyException(Throwable cause, String logdir) {
		super(AccessDenyErrorCode, cause, logdir);
	}

	public AccessDenyException(Throwable cause, String logdir, String logfilename) {
		super(AccessDenyErrorCode, cause, logdir, logfilename);
	}

	public AccessDenyException(Throwable cause) {
		super(AccessDenyErrorCode, cause);
	}

	public AccessDenyException(String message, Throwable cause) {
		super(AccessDenyErrorCode, message, cause);
	}

	public AccessDenyException(String message, Throwable cause, boolean enableSuppression, boolean writableStackTrace) {
		super(message, cause, enableSuppression, writableStackTrace);
		this.code = AccessDenyErrorCode;
	}

}
