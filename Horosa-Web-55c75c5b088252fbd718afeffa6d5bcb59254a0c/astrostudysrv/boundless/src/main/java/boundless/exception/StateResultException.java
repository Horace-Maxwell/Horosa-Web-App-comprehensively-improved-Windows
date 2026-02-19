package boundless.exception;

public class StateResultException extends AppException {
	private static final long serialVersionUID = -8084942267944547545L;

	public StateResultException() {
	}

	public StateResultException(String message) {
		super(message);
	}

	public StateResultException(Throwable cause) {
		super(cause);
	}

	public StateResultException(String message, Throwable cause) {
		super(message, cause);
	}

	public StateResultException(String message, Throwable cause,
			boolean enableSuppression, boolean writableStackTrace) {
		super(message, cause, enableSuppression, writableStackTrace);
	}

}
