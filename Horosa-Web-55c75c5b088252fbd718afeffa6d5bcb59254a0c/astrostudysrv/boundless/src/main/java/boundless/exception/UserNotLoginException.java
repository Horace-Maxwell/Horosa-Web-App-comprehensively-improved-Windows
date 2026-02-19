package boundless.exception;

import boundless.exception.AppException;



public class UserNotLoginException extends AppException {
	private static final long serialVersionUID = 7215496257984323479L;

	public UserNotLoginException() {
	}

	public UserNotLoginException(String message, Throwable cause,
			boolean enableSuppression, boolean writableStackTrace) {
		super(message, cause, enableSuppression, writableStackTrace);
	}

	public UserNotLoginException(String message, Throwable cause) {
		super(message, cause);
	}

	public UserNotLoginException(String message) {
		super(message);
	}

	public UserNotLoginException(Throwable cause) {
		super(cause);
	}

}
