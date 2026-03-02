package boundless.exception;

public class HttpStatusException extends AppException {
	private static final long serialVersionUID = 1L;
	
	private int status;

	public HttpStatusException(int status) {
		this.status = status;
	}

	public HttpStatusException(String message) {
		super(message);
	}

	public HttpStatusException(Throwable cause) {
		super(cause);
	}

	public HttpStatusException(String message, Throwable cause) {
		super(message, cause);
	}

	public HttpStatusException(String message, Throwable cause, boolean enableSuppression, boolean writableStackTrace) {
		super(message, cause, enableSuppression, writableStackTrace);
	}

	public int getStatus() {
		return this.status;
	}
}
