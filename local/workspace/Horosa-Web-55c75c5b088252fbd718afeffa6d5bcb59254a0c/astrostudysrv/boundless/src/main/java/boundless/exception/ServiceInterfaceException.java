package boundless.exception;

public class ServiceInterfaceException extends AppException {
	private static final long serialVersionUID = 1821036226324293868L;

	public ServiceInterfaceException() {
	}

	public ServiceInterfaceException(String message) {
		super(message);
	}

	public ServiceInterfaceException(Throwable cause) {
		super(cause);
	}

	public ServiceInterfaceException(String message, Throwable cause) {
		super(message, cause);
	}

	public ServiceInterfaceException(String message, Throwable cause, boolean enableSuppression, boolean writableStackTrace) {
		super(message, cause, enableSuppression, writableStackTrace);
	}

}
