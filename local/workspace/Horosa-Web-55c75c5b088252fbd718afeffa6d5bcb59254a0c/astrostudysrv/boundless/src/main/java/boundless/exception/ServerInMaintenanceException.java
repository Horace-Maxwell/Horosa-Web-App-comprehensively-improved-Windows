package boundless.exception;


public class ServerInMaintenanceException extends AppException {
	private static final long serialVersionUID = 7215496257984323479L;

	public ServerInMaintenanceException() {
	}

	public ServerInMaintenanceException(String message, Throwable cause,
			boolean enableSuppression, boolean writableStackTrace) {
		super(message, cause, enableSuppression, writableStackTrace);
	}

	public ServerInMaintenanceException(String message, Throwable cause) {
		super(message, cause);
	}

	public ServerInMaintenanceException(String message) {
		super(message);
	}

	public ServerInMaintenanceException(Throwable cause) {
		super(cause);
	}

}
