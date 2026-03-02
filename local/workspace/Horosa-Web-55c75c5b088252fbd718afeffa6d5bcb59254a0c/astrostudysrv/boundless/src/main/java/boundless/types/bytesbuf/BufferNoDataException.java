package boundless.types.bytesbuf;

public class BufferNoDataException extends RuntimeException {
	private static final long serialVersionUID = -1634785390252051331L;

	public BufferNoDataException() {
	}

	public BufferNoDataException(String message) {
		super(message);
	}

	public BufferNoDataException(Throwable cause) {
		super(cause);
	}

	public BufferNoDataException(String message, Throwable cause) {
		super(message, cause);
	}

	public BufferNoDataException(String message, Throwable cause, boolean enableSuppression, boolean writableStackTrace) {
		super(message, cause, enableSuppression, writableStackTrace);
	}

}
