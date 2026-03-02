package boundless.exception;


public class CustomizeException extends AppException {
	private static final long serialVersionUID = 7215496257984323479L;

	public CustomizeException() {
	}

	public CustomizeException(String message, Throwable cause,
			boolean enableSuppression, boolean writableStackTrace) {
		super(message, cause, enableSuppression, writableStackTrace);
	}

	public CustomizeException(String message, Throwable cause) {
		super(message, cause);
	}

	public CustomizeException(String message) {
		super(message);
	}

	public CustomizeException(Throwable cause) {
		super(cause);
	}

}
