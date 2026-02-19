package boundless.exception;

public class SignatureException extends AppException {
	private static final long serialVersionUID = -5650796707914695119L;

	public SignatureException() {
		super("signature.error");
	}

	public SignatureException(String message, Throwable cause,
			boolean enableSuppression, boolean writableStackTrace) {
		super(message, cause, enableSuppression, writableStackTrace);
	}

	public SignatureException(String message, Throwable cause) {
		super(message, cause);
	}

	public SignatureException(String message) {
		super(message);
	}

	public SignatureException(Throwable cause) {
		super(cause);
	}
	
	

}
