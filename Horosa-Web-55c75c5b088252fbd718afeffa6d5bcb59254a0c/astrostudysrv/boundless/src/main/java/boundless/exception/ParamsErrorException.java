package boundless.exception;


public class ParamsErrorException extends AppException {
	private static final long serialVersionUID = 7215496257984323479L;

	public ParamsErrorException() {
	}

	public ParamsErrorException(String message, Throwable cause,
			boolean enableSuppression, boolean writableStackTrace) {
		super(message, cause, enableSuppression, writableStackTrace);
	}

	public ParamsErrorException(String message, Throwable cause) {
		super(message, cause);
	}

	public ParamsErrorException(String message) {
		super(message);
	}

	public ParamsErrorException(Throwable cause) {
		super(cause);
	}

}
