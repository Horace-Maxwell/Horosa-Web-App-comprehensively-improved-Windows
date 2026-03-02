package boundless.net;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public final class DateTimeFormatUtility {
	private static final DateTimeFormatter DATE_TIME_FORMATTER=DateTimeFormatter.ofPattern("yyy-MM-dd HH:mm:ss.SSS");
	private static final DateTimeFormatter MS_TIME_FORMATTER=DateTimeFormatter.ofPattern("HH:mm:ss.SSS");
	
	public static String currentTime(){
		return LocalDateTime.now().format(MS_TIME_FORMATTER);
	}
	
	public static String currentDateTime(){
		return LocalDateTime.now().format(DATE_TIME_FORMATTER);
	}
}
