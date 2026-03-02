package boundless.exception;


public class EncryptException extends AppException {
	private static final long serialVersionUID = 7215496257984323479L;

	public EncryptException() {
	}

	public EncryptException(String message, Throwable cause,
			boolean enableSuppression, boolean writableStackTrace) {
		super(message, cause, enableSuppression, writableStackTrace);
	}

	public EncryptException(String message, Throwable cause) {
		super(message, cause);
	}

	public EncryptException(String message) {
		super(message);
	}

	public EncryptException(Throwable cause) {
		super(cause);
	}

}
