package boundless.exception;


public class DataVerifyFailException extends AppException {
	private static final long serialVersionUID = 7215496257984323479L;

	public DataVerifyFailException() {
	}

	public DataVerifyFailException(String message, Throwable cause,
			boolean enableSuppression, boolean writableStackTrace) {
		super(message, cause, enableSuppression, writableStackTrace);
	}

	public DataVerifyFailException(String message, Throwable cause) {
		super(message, cause);
	}

	public DataVerifyFailException(String message) {
		super(message);
	}

	public DataVerifyFailException(Throwable cause) {
		super(cause);
	}

}
