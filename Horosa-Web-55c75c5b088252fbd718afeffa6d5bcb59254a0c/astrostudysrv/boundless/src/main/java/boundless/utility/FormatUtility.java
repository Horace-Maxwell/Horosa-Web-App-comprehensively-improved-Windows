package boundless.utility;

import java.text.DateFormat;
import java.text.MessageFormat;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.time.LocalDateTime;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;

import org.joda.time.DateTime;
import org.joda.time.format.DateTimeFormatter;
import org.joda.time.format.ISODateTimeFormat;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;

/**
 * 常用类型格式转换实用类，以静态方法提供常用类型格式转换的功能
 * 常用类型格式的处理或转换：支持多种格式，用法如下：
 * <ul>
 * <li>formatNumberString(1234.5,"0") &emsp; // 1235，</li>
 * <li>formatNumberString(12345,"0.00") &emsp; // 12345.00，</li>
 * <li>formatNumberString(1234.0552,"0.000") &emsp; // 1234.056，</li>
 * <li>formatNumberString(12345,"0.00%") &emsp; // 1234500.00%，</li>
 * <li>formatNumberString(12345,"$0.00") &emsp; // $12345.00，</li>
 * <li>formatNumberString(12345,"共0公斤") &emsp; // 共12345公斤，</li>
 * <li>formatNumberString(12345,"#,###.00") &emsp; // 12,345.00</li>
 * </ul>
 * 参数一可以为（Float, int, string, double类型)，返回值为string型
 * <br>
 * @author zjf
 *
 */
public class FormatUtility {
	public static final String ISOKey = "iso";
	public static final String ISOZKey = "isoz";
	
	
	private static String FORMAT_STRING="yyyyMMddHHmmssSSS";
	private static SimpleDateFormat _yyyyMMddHHmmssSSSFormat=new SimpleDateFormat(FORMAT_STRING);
	private static SimpleDateFormat _yyyyMMddHHmmssFormat=new SimpleDateFormat("yyyyMMddHHmmss");
	private static SimpleDateFormat _yyyyMMddFormat=new SimpleDateFormat("yyyyMMdd");
	
	private static Map<String, Integer> monthMap = new HashMap<String, Integer>();
	
	static private Date _errorDate = null;
	
	public static Date errorDate(){
		if(_errorDate == null){
	    	Calendar cal = Calendar.getInstance();
	    	cal.set(1, 0, 1, 0, 0, 0);
	    	_errorDate = cal.getTime();		
		}
		return _errorDate;
	}
	
	public static String yyyyMMddHHmmss(Date date){
		return _yyyyMMddHHmmssFormat.format(date);
	}
	
	public static String yyyyMMddHHmmssSSS(Date date){
		return _yyyyMMddHHmmssSSSFormat.format(date);
	}
	
	public static String yyyyMMdd(Date date){
		return _yyyyMMddFormat.format(date);
	}
	
	/**
	 * 根据formart格式（如"0.00%"）格式化数字格式，返回string
	 * @param valueDouble 源数字
	 * @param format 格式（如"0.00%"、"$0.0元"、"#,###.00"等
	 * @return
	 */
    static public String formatNumberString(double valueDouble, String format)
    {
        if (format == null || format == "" || Double.isNaN(valueDouble))
            return "";

        String valueStr = MessageFormat.format("{0, number," + format + "}", valueDouble);

		if(valueStr.startsWith("."))
			valueStr = "0" + valueStr;

        return valueStr;
    }
    
    /**
     * 根据formart（如"0.00%"）把指定的数字进行格式化，返回string
     * @param valueFloat 源数字
     * @param format 格式（如"0.00%"、"$0.0元"、"#,###.00"等
     * @return
     */
    static public String formatNumberString(float valueFloat, String format)
    {
        return formatNumberString(valueFloat + "", format);
    }
    
    /**
     * 根据formart（如"0.00%"）把指定的值进行格式化，返回string
     * @param valueInt 源数字
     * @param format 格式（如"0.00%"、"$0.0元"、"#,###.00"等
     * @return
     */
    static public String FormatNumberString(int valueInt, String format)
    {
        return formatNumberString(valueInt + "", format);
    }
    
    /**
     * 根据formart（如"0.00%"）把指定的值进行格式化，返回string
     * @param valueStr 源数字
     * @param format 格式（如"0.00%"、"$0.0元"、"#,###.00"等
     * @return
     */
    static public String formatNumberString(String valueStr, String format)
    {
        if (valueStr == null || format == null || format == "")
            return "";

        double valueDouble = 0;
        try
        {
            valueDouble = Double.valueOf(valueStr);
        }
        catch (Exception e) { }
        return formatNumberString(valueDouble, format);
    }
    
    /**
     * 将valueStr进行替换处理，使其符合xml的字符规则：需转换的字符有："&amp;"、"&lt;"、"&gt;"，
     * @param valueObj
     * @return
     */
    static public String formatStringForXML(Object valueObj)
    {
        return formatStringForXML(valueObj == null ? "null" : valueObj.toString(), false);
    }
    
    /**
     * 将valueStr进行替换处理，使其符合xml的字符规则:需转换的字符有："&amp;"、"&lt;"、"&gt;"，
     * 如果quoted为true，刚表示返回结果需再加上双引号
     * @param valueObj
     * @param quoted
     * @return
     */
    static public String formatStringForXML(Object valueObj, boolean quoted)
    {
        return formatStringForXML(valueObj == null ? "null" : valueObj.toString(), quoted);
    }
    
    /**
     * 将字符串进行替换处理，使其符合xml的字符规则:需转换的字符有："&amp;"、"&lt;"、"&gt;"，
     * @param valueStr 源字串
     * @return
     */
    static public String formatStringForXML(String valueStr)
    {
        return formatStringForXML(valueStr, false);
    }
    
    /**
     * 将字符串进行替换处理，使其符合xml属性的字符规则:需转换的字符有："&amp;"、"\"、"&lt;"、"&gt;"等
     * @param valueStr 源字串
     * @param quoted 是否在返回值两边加上双引号
     * @return
     */
    static public String formatStringForXMLAttribute(String valueStr, boolean quoted)
    {
        valueStr = formatStringForXML(valueStr, false);
        valueStr = valueStr.replace("\"", "&quot;");
        if (quoted) valueStr = "\"" + valueStr + "\"";
        return valueStr;
    }
    
    /**
     * 将valueStr进行替换处理，使其符合xml的字符规则:需转换的字符有："&amp;"、"&lt;"、"&gt;"，
     * 如果quoted为true，刚表示返回结果需再加上双引号
     * @param valueStr 源字串
     * @param quoted 是否在返回值两边加上双引号
     * @return
     */
    static public String formatStringForXML(String valueStr, boolean quoted)
    {
        if (valueStr == null) valueStr = "";
        valueStr = valueStr.replace("&", "&#38;");
        valueStr = valueStr.replace("<", "&lt;");
        valueStr = valueStr.replace(">", "&gt;");
        if (quoted) valueStr = "\"" + valueStr + "\"";
        return valueStr;
    }
    
    /**
     * 是否是有效的xml字符
     * @param character
     * @return
     */
    public static boolean isLegalXmlChar(char character)
    {
        return
        !(
             (character >= 0x00 && character <= 0x08) ||
             (character >= 0x0B && character <= 0x0C) ||
             (character >= 0x0E && character <= 0x1F) ||
             (character == 0x7F)
        );
    }
    
    /**
     * 清洁xml字符串，把不合法的字符去掉
     * @param sourceStr
     * @param replace
     * @return
     */
    public static String sanitizeXmlString(String sourceStr, String replace){
        if (sourceStr == null) return sourceStr;

        StringBuilder buffer = new StringBuilder(sourceStr.length());

        for (char c : sourceStr.toCharArray())
        {
            if (isLegalXmlChar(c))
            {
                buffer.append(c);
            }
        }

        return buffer.toString().replaceAll("[^\\x20-\\x7e]", replace);

    }
    
    /**
     * 将DateTime值转换成指定格式的日期字符串
     * @param dt
     * @param format 日期格式
     * @return 返回对应格式的string值
     */
    static public String formatDateTime(Date dt, String format){
    	if(format.toLowerCase().startsWith(FormatUtility.ISOZKey)){
    		Calendar cal = Calendar.getInstance();
    		cal.setTime(dt);
    		DateTimeFormatter fmt = ISODateTimeFormat.dateTime();
    		DateTime jodadt = new DateTime(cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH),
    				cal.get(Calendar.HOUR_OF_DAY), cal.get(Calendar.MINUTE), cal.get(Calendar.SECOND), cal.get(Calendar.MILLISECOND));
    		String[] res = fmt.print(jodadt).split("\\+");
    		return res[0] + "Z";
    	}
    	if(format.toLowerCase().startsWith(FormatUtility.ISOKey)){
    		Calendar cal = Calendar.getInstance();
    		cal.setTime(dt);
    		DateTimeFormatter fmt = ISODateTimeFormat.dateTime();
    		DateTime jodadt = new DateTime(cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH),
    				cal.get(Calendar.HOUR_OF_DAY), cal.get(Calendar.MINUTE), cal.get(Calendar.SECOND), cal.get(Calendar.MILLISECOND));
    		return fmt.print(jodadt);
    	}
    	
        format = convertFormat(format);
        Calendar cal = Calendar.getInstance();
        cal.setTime(dt);
        int y = cal.get(Calendar.YEAR);
        
        SimpleDateFormat df = new SimpleDateFormat(format);
        String result = df.format(dt);

        //以下用于防止特别日期选项（民国日期）时造成转换结果与实际formart不符
        if (result.length() != format.length()){
            df = new SimpleDateFormat(format, Locale.PRC);
            result = df.format(dt);
        }
        if(y < 0) {
        	return "-" + result;
        }
        return result;
    }
    
    static public String formatDateTime(Date dt, String format, TimeZone timezone){
    	Date date = new Date();
		long offset = timezone.getOffset(dt.getTime());
		long tm = dt.getTime() - offset;
		date.setTime(tm);
		return formatDateTime(date, format);
    }
    
    /**
     * 将string形式的日期转换成Date类型
     * @param dateTimeStr 源日期string
     * @param format 源日期格式
     * @return 返回转换后的Date类型
     */
    static public Date parseDateTime(String dateTimeStr, String format){
        try{
        	if(format.toLowerCase().startsWith(FormatUtility.ISOKey)){
        		DateTimeFormatter fmt = ISODateTimeFormat.dateTime();
        		DateTime dt = fmt.parseDateTime(dateTimeStr);
        		Date d = dt.toDate();
        		return d;
        	}
            return parseEngDateTime(dateTimeStr, format);
        }catch (Exception e){
        	QueueLog.error(AppLoggers.ErrorLogger, e);
            return errorDate();
        }
    }
    
    static public Date parseEngDateTime(String dateTimeStr, String format){
		dateTimeStr = dateTimeStr.replace('T', ' ');
    	String str = dateTimeStr;
    	int ad = 1;
    	if(dateTimeStr.indexOf('-') == 0) {
    		ad = -1;
    		str = str.substring(1);
    	}
    	DateFormat df = new SimpleDateFormat(format);
    	try {
			Date dt = df.parse(str);
			Calendar cal = Calendar.getInstance();
			cal.setTime(dt);
			return cal.getTime();
		} catch (Exception e) {
			throw new RuntimeException(e);
		}
    }
    
    static public Date parseDateTime(String dateTimeStr, String format, TimeZone timezone){
    	Date dt = parseDateTime(dateTimeStr, format);
    	if(format.toLowerCase().startsWith(FormatUtility.ISOKey)){
    		return dt;
    	}
    	long tm = dt.getTime();
    	long offset = timezone.getOffset(tm);
    	long newtm = tm + offset;
    	dt.setTime(newtm);
    	return dt;
    }
    
    static public Date parseDateTimeIgnoreCase(String dtstr, String format){
    	String dateTimeStr = dtstr.trim();
		dateTimeStr = dateTimeStr.replace('T', ' ');
    	format = format.trim();
    	int ad = 1;
    	if(dateTimeStr.indexOf('-') == 0) {
    		ad = -1;
    		dateTimeStr = dateTimeStr.substring(1);
    	}
    	
        Calendar cal = Calendar.getInstance();
        int year = 1970;
        int month = 0;
        int day = 1;
        int hour = 0;
        int minute = 0;
        int second = 0;
        int ms = 0;

        String tmpformat = convertFormat(format);
        if (tmpformat.equalsIgnoreCase("yyyyMM"))
        {
            year = Integer.valueOf(dateTimeStr.substring(0, 4));
            month = Integer.valueOf(dateTimeStr.substring(4)) - 1;
        }
        else if (tmpformat.equalsIgnoreCase("yyyy/MM"))
        {
            year = Integer.valueOf(dateTimeStr.substring(0, 4));
            month = Integer.valueOf(dateTimeStr.substring(5)) - 1;
        }
        else if (tmpformat.equalsIgnoreCase("yyyyMMdd"))
        {
            year = Integer.valueOf(dateTimeStr.substring(0, 4));
            month = Integer.valueOf(dateTimeStr.substring(4, 6)) - 1;
            day = Integer.valueOf(dateTimeStr.substring(6));

        }
        else if (tmpformat.equalsIgnoreCase("yyyy/MM/dd"))
        {
            year = Integer.valueOf(dateTimeStr.substring(0, 4));
            month = Integer.valueOf(dateTimeStr.substring(5, 7)) - 1;
            day = Integer.valueOf(dateTimeStr.substring(8)) - 1;
        }
        else if (tmpformat.equalsIgnoreCase("yyyy/MM/dd HH:mm"))
        {
            year = Integer.valueOf(dateTimeStr.substring(0, 4));
            month = Integer.valueOf(dateTimeStr.substring(5, 7)) - 1;
            day = Integer.valueOf(dateTimeStr.substring(8));
            if (dateTimeStr.length()>11)
            hour = Integer.valueOf(dateTimeStr.substring(11, 13));
            if (dateTimeStr.length() > 14)
            minute = Integer.valueOf(dateTimeStr.substring(14, 16));
        }
        else if (tmpformat.equalsIgnoreCase("yyyyMMddHHmm"))
        {
            year = Integer.valueOf(dateTimeStr.substring(0, 4));
            month = Integer.valueOf(dateTimeStr.substring(4, 6)) - 1;
            day = Integer.valueOf(dateTimeStr.substring(6, 8));
            if (dateTimeStr.length() > 8)
            hour = Integer.valueOf(dateTimeStr.substring(8, 10));
            if (dateTimeStr.length() > 10)
            minute = Integer.valueOf(dateTimeStr.substring(10, 12));
        }
        else if (tmpformat.equalsIgnoreCase("yyyyMMddHHmmss"))
        {
            year = Integer.valueOf(dateTimeStr.substring(0, 4));
            month = Integer.valueOf(dateTimeStr.substring(4, 6)) - 1;
            day = Integer.valueOf(dateTimeStr.substring(6, 8));
            if (dateTimeStr.length() > 8)
            hour = Integer.valueOf(dateTimeStr.substring(8, 10));
            if (dateTimeStr.length() > 10)
            minute = Integer.valueOf(dateTimeStr.substring(10, 12));
            if (dateTimeStr.length() > 12)
            second = Integer.valueOf(dateTimeStr.substring(12, 14));
        }
        else if (tmpformat.equalsIgnoreCase("yyMMddHHmmss"))
        {
            year = 2000 + Integer.valueOf(dateTimeStr.substring(0, 2));
            if(year >= 2090){
            	year -= 100; 
            }
            month = Integer.valueOf(dateTimeStr.substring(2, 4)) - 1;
            day = Integer.valueOf(dateTimeStr.substring(4, 6));
            if (dateTimeStr.length() > 8)
            hour = Integer.valueOf(dateTimeStr.substring(6, 8));
            if (dateTimeStr.length() > 10)
            minute = Integer.valueOf(dateTimeStr.substring(8, 10));
            if (dateTimeStr.length() > 12)
            second = Integer.valueOf(dateTimeStr.substring(10, 12));
        }
        else if (tmpformat.equalsIgnoreCase("yyyyMMddHHmmssSSS"))
        {
            year = Integer.valueOf(dateTimeStr.substring(0, 4));
            month = Integer.valueOf(dateTimeStr.substring(4, 6)) - 1;
            day = Integer.valueOf(dateTimeStr.substring(6, 8));
            if (dateTimeStr.length() > 8)
            hour = Integer.valueOf(dateTimeStr.substring(8, 10));
            if (dateTimeStr.length() > 10)
            minute = Integer.valueOf(dateTimeStr.substring(10, 12));
            if (dateTimeStr.length() > 12)
            second = Integer.valueOf(dateTimeStr.substring(12, 14));
            if (dateTimeStr.length() > 14)
            ms = Integer.valueOf(dateTimeStr.substring(14));            
        }
        else if (tmpformat.equalsIgnoreCase("HHmm"))
        {
            hour = Integer.valueOf(dateTimeStr.substring(0, 2));
            minute = Integer.valueOf(dateTimeStr.substring(2));
        }
        else if (tmpformat.equalsIgnoreCase("HH:mm"))
        {
            hour = Integer.valueOf(dateTimeStr.substring(0, 2));
            minute = Integer.valueOf(dateTimeStr.substring(3));
        }
        else if (tmpformat.equalsIgnoreCase("HHmmss"))
        {
            hour = Integer.valueOf(dateTimeStr.substring(0, 2));
            minute = Integer.valueOf(dateTimeStr.substring(2, 4));
            second = Integer.valueOf(dateTimeStr.substring(4, 6));
        }
        else if (tmpformat.equalsIgnoreCase("HH:mm:ss"))
        {
            hour = Integer.valueOf(dateTimeStr.substring(0, 2));
            minute = Integer.valueOf(dateTimeStr.substring(3, 5));
            second = Integer.valueOf(dateTimeStr.substring(6, 8));
        }
        else if (tmpformat.equalsIgnoreCase("yyyy-MM-dd"))
        {
            year = Integer.valueOf(dateTimeStr.substring(0, 4));
            month = Integer.valueOf(dateTimeStr.substring(5, 7)) - 1;
            day = Integer.valueOf(dateTimeStr.substring(8, 10));
        }
        else if (tmpformat.equalsIgnoreCase("yyyy-MM-dd HH:mm"))
        {
            year = Integer.valueOf(dateTimeStr.substring(0, 4));
            month = Integer.valueOf(dateTimeStr.substring(5, 7)) - 1;
            day = Integer.valueOf(dateTimeStr.substring(8, 10));
            hour = Integer.valueOf(dateTimeStr.substring(11, 13));
            minute = Integer.valueOf(dateTimeStr.substring(14, 16));
        }
        else if (tmpformat.equalsIgnoreCase("yyyy-MM-dd HH:mm:ss"))
        {
            year = Integer.valueOf(dateTimeStr.substring(0, 4));
            month = Integer.valueOf(dateTimeStr.substring(5, 7)) - 1;
            day = Integer.valueOf(dateTimeStr.substring(8, 10));
            hour = Integer.valueOf(dateTimeStr.substring(11, 13));
            minute = Integer.valueOf(dateTimeStr.substring(14, 16));
            second = Integer.valueOf(dateTimeStr.substring(17,19));
        }
        else if (tmpformat.equalsIgnoreCase("yyyy-MM-dd HH:mm:ss.S") || tmpformat.equalsIgnoreCase("yyyy-MM-dd HH:mm:ss.SSS"))
        {
            year = Integer.valueOf(dateTimeStr.substring(0, 4));
            month = Integer.valueOf(dateTimeStr.substring(5, 7)) - 1;
            day = Integer.valueOf(dateTimeStr.substring(8, 10));
            hour = Integer.valueOf(dateTimeStr.substring(11, 13));
            minute = Integer.valueOf(dateTimeStr.substring(14, 16));
            second = Integer.valueOf(dateTimeStr.substring(17, 19));
            ms = Integer.valueOf(dateTimeStr.substring(20));
        }else{
        	try{
        		return parseEngDateTime(dateTimeStr, format);
        	}catch(Exception e){
        		QueueLog.error(AppLoggers.ErrorLogger, e);
        	}
        }
        cal.set(year*ad, month, day, hour, minute, second);
        cal.set(Calendar.MILLISECOND, ms);
        return cal.getTime();
    }
    
    public static LocalDateTime parseLocalDateTime(String dtstr, String format) {
    	Date dt = parseDateTime(dtstr, format);
    	return ConvertUtility.getValueAsLocalDateTime(dt);
    }

    public static String convertFormat(String format){
        String tmpformat = format.toUpperCase();
        String res = format;
        if (tmpformat.equalsIgnoreCase("YYYYMM")) res = "yyyyMM";
        else if (tmpformat.equalsIgnoreCase("YYYY/MM")) res = "yyyy/MM";
        else if (tmpformat.equalsIgnoreCase("YYYYMMDD")) res = "yyyyMMdd";
        else if (tmpformat.equalsIgnoreCase("YYYY/MM/DD")) res = "yyyy/MM/dd";
        else if (tmpformat.equalsIgnoreCase("YYYY/MM/DD HH:MM")) res = "yyyy/MM/dd HH:mm";
        else if (tmpformat.equalsIgnoreCase("YYYYMMDDHHMM")) res = "yyyyMMddHHmm";
        else if (tmpformat.equalsIgnoreCase("YYYYMMDDHHMMSS")) res = "yyyyMMddHHmmss";
        else if (tmpformat.equalsIgnoreCase("YYYYMMDDHHMMSSSSS")) res = "yyyyMMddHHmmssSSS";
        else if (tmpformat.equalsIgnoreCase("HHMM")) res = "HHmm";
        else if (tmpformat.equalsIgnoreCase("HH:MM")) res = "HH:mm";
        else if (tmpformat.equalsIgnoreCase("HHMMSS")) res = "HHmmss";
        else if (tmpformat.equalsIgnoreCase("HH:MM:SS")) res = "HH:mm:ss";
        else if (tmpformat.equalsIgnoreCase("HH:MM:SS.S")) res = "HH:mm:ss.S";
        else if (tmpformat.equalsIgnoreCase("HH:MM:SS.SSS")) res = "HH:mm:ss.SSS";
        else if (tmpformat.equalsIgnoreCase("YYYY-MM-DD")) res = "yyyy-MM-dd";
        else if (tmpformat.equalsIgnoreCase("YYYY-MM-DD HH:MM:SS")) res = "yyyy-MM-dd HH:mm:ss";
        else if (tmpformat.equalsIgnoreCase("YYYY-MM-DD HH:MM:SS.S")) res = "yyyy-MM-dd HH:mm:ss.S";
        else if (tmpformat.equalsIgnoreCase("YYYY-MM-DD HH:MM:SS.SSS")) res = "yyyy-MM-dd HH:mm:ss.SSS";
        else if (tmpformat.equalsIgnoreCase("YYYY-MM-DD HH:MM")) res = "yyyy-MM-dd HH:mm";
        else if (tmpformat.equalsIgnoreCase("YYMMDDHHMMSS")) res = "yyMMddHHmmss";

        return res;
    }
    
    public static Date parseDateTime(long ms){
    	Date dt = new Date();
    	dt.setTime(ms);
    	return dt;
    }
    
    public static String formatDateTime(LocalDateTime date) {
    	java.time.format.DateTimeFormatter df = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    	String str = date.format(df);
    	return str;
    }
    
    public static String formatDateTime(LocalDateTime date, String fmt) {
    	java.time.format.DateTimeFormatter df = java.time.format.DateTimeFormatter.ofPattern(fmt);
    	String str = date.format(df);
    	return str;
    }
    
    
    static public void main(String[] args){
//    	String str = FormatUtility.formatNumberString(12345.67, "共0.00公斤");
//    	System.out.println(str);
//    	
//		Calendar cal = Calendar.getInstance();
//		cal.set(2014, 0, 1, 1, 1, 1);
//		String actual = formatDateTime(cal.getTime(), "yyyy-MM-dd HH:mm:ss.S");
//    	System.out.println(actual);
//    	
//    	Date date = parseDateTime(actual, "yyyy-MM-dd HH:mm:ss");
//    	System.out.println(date);
//    	System.out.println(formatDateTime(date, "yyyy-MM-dd HH:mm:ss.S"));
    	
    	TimeZone zone = TimeZone.getTimeZone("Asia/Shanghai");
    	
    	System.out.println("org: -2016-09-06 18:05:53.043");
    	Date dt = parseDateTime("-2016-09-06 18:05:53.043", "yyyy-MM-dd HH:mm:ss.SSS");
    	
    	String zonedtstr = formatDateTime(dt, "yyyy-MM-dd HH:mm:ss.SSS", zone);
    	System.out.println("zone: " + zonedtstr);
    	
    	Date dt1 = parseDateTime(zonedtstr, "yyyy-MM-dd HH:mm:ss.SSS", zone);
    	System.out.println(formatDateTime(dt1, "yyyy-MM-dd HH:mm:ss.SSS"));
    }

}
