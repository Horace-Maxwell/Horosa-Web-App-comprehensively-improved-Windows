package boundless.exception;

public class NeedLoginException extends AppException {
	private static final long serialVersionUID = 6773506521351466063L;

	public NeedLoginException() {
		super();
	}

	public NeedLoginException(String message, Throwable cause,
			boolean enableSuppression, boolean writableStackTrace) {
		super(message, cause, enableSuppression, writableStackTrace);
	}

	public NeedLoginException(String message, Throwable cause) {
		super(message, cause);
	}

	public NeedLoginException(String message) {
		super(message);
	}

	public NeedLoginException(Throwable cause) {
		super(cause);
	}

	
}
