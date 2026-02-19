package boundless.log;

import org.apache.logging.log4j.spi.ExtendedLogger;
import org.apache.logging.slf4j.Log4jLogger;

public class CenterLogger extends Log4jLogger {
	private static final long serialVersionUID = -4167537113764712590L;

	public CenterLogger(ExtendedLogger logger, String name) {
		super(logger, name);
	}



}
