package boundless.exception;


public class ParamsIllegalException extends AppException {
	private static final long serialVersionUID = 7215496257984323479L;

	public ParamsIllegalException() {
	}

	public ParamsIllegalException(String message, Throwable cause,
			boolean enableSuppression, boolean writableStackTrace) {
		super(message, cause, enableSuppression, writableStackTrace);
	}

	public ParamsIllegalException(String message, Throwable cause) {
		super(message, cause);
	}

	public ParamsIllegalException(String message) {
		super(message);
	}

	public ParamsIllegalException(Throwable cause) {
		super(cause);
	}

}
