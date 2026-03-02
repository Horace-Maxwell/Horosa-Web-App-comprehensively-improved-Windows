package boundless.exception;

public class DecompressException extends AppException {
	private static final long serialVersionUID = -2921885165162218769L;

	public DecompressException() {
	}

	public DecompressException(String message, Throwable cause,
			boolean enableSuppression, boolean writableStackTrace) {
		super(message, cause, enableSuppression, writableStackTrace);
	}

	public DecompressException(String message, Throwable cause) {
		super(message, cause);
	}

	public DecompressException(String message) {
		super(message);
	}

	public DecompressException(Throwable cause) {
		super(cause);
	}

}
