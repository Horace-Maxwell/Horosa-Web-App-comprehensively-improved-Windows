package boundless.exception;

import boundless.exception.AppException;


public class ActionIdInvalidException extends AppException {
	private static final long serialVersionUID = 618341525784627082L;

	public ActionIdInvalidException() {
	}

	public ActionIdInvalidException(String message, Throwable cause,
			boolean enableSuppression, boolean writableStackTrace) {
		super(message, cause, enableSuppression, writableStackTrace);
	}

	public ActionIdInvalidException(String message, Throwable cause) {
		super(message, cause);
	}

	public ActionIdInvalidException(String message) {
		super(message);
	}

	public ActionIdInvalidException(Throwable cause) {
		super(cause);
	}

}
