package boundless.exception;


public class RequestDataTooLongException extends AppException {
	private static final long serialVersionUID = 7215496257984323479L;

	public RequestDataTooLongException() {
	}

	public RequestDataTooLongException(String message, Throwable cause,
			boolean enableSuppression, boolean writableStackTrace) {
		super(message, cause, enableSuppression, writableStackTrace);
	}

	public RequestDataTooLongException(String message, Throwable cause) {
		super(message, cause);
	}

	public RequestDataTooLongException(String message) {
		super(message);
	}

	public RequestDataTooLongException(Throwable cause) {
		super(cause);
	}

}
