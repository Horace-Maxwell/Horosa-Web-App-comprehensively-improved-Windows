package boundless.exception;


public class NoDataException extends AppException {
	private static final long serialVersionUID = 7215496257984323479L;

	public NoDataException() {
	}

	public NoDataException(String message, Throwable cause,
			boolean enableSuppression, boolean writableStackTrace) {
		super(message, cause, enableSuppression, writableStackTrace);
	}

	public NoDataException(String message, Throwable cause) {
		super(message, cause);
	}

	public NoDataException(String message) {
		super(message);
	}

	public NoDataException(Throwable cause) {
		super(cause);
	}

}
