package boundless.exception;

public class DecryptException extends AppException {
	private static final long serialVersionUID = -6279217825038674085L;

	public DecryptException() {
	}

	public DecryptException(String message, Throwable cause,
			boolean enableSuppression, boolean writableStackTrace) {
		super(message, cause, enableSuppression, writableStackTrace);
	}

	public DecryptException(String message, Throwable cause) {
		super(message, cause);
	}

	public DecryptException(String message) {
		super(message);
	}

	public DecryptException(Throwable cause) {
		super(cause);
	}

}
