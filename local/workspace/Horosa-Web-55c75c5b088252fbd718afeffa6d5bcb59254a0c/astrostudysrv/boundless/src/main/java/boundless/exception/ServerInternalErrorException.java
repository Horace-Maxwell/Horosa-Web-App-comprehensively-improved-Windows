package boundless.exception;


public class ServerInternalErrorException extends AppException {
	private static final long serialVersionUID = 7215496257984323479L;

	public ServerInternalErrorException() {
	}

	public ServerInternalErrorException(String message, Throwable cause,
			boolean enableSuppression, boolean writableStackTrace) {
		super(message, cause, enableSuppression, writableStackTrace);
	}

	public ServerInternalErrorException(String message, Throwable cause) {
		super(message, cause);
	}

	public ServerInternalErrorException(String message) {
		super(message);
	}

	public ServerInternalErrorException(Throwable cause) {
		super(cause);
	}

}
