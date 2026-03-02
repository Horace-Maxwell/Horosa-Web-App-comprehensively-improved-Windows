package boundless.exception;

import boundless.exception.AppException;


public class UserExistException extends AppException {
	private static final long serialVersionUID = 7215496257984323479L;

	public UserExistException() {
	}

	public UserExistException(String message, Throwable cause,
			boolean enableSuppression, boolean writableStackTrace) {
		super(message, cause, enableSuppression, writableStackTrace);
	}

	public UserExistException(String message, Throwable cause) {
		super(message, cause);
	}

	public UserExistException(String message) {
		super(message);
	}

	public UserExistException(Throwable cause) {
		super(cause);
	}

}
