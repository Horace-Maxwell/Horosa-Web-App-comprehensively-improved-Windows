package boundless.utility;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.LocalDateTime;
import java.util.Calendar;
import java.util.Collection;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.time.format.DateTimeFormatter;

import boundless.security.SecurityUtility;
import boundless.types.IObjectConverter;
import boundless.types.OutParameter;

/**
 * 类型转换实用类，以静态方法提供类型转换常用的功能
 * @author zjf
 *
 */
public class ConvertUtility {

	private static HashMap<Class, IObjectConverter> _converters = new HashMap<Class, IObjectConverter>();
	
	static{
		IObjectConverter primitiveConverter = new PrimitiveArrayConverter();
		ConvertUtility.addConverter(byte[].class, primitiveConverter);
		ConvertUtility.addConverter(short[].class, primitiveConverter);
		ConvertUtility.addConverter(int[].class, primitiveConverter);
		ConvertUtility.addConverter(long[].class, primitiveConverter);
		ConvertUtility.addConverter(float[].class, primitiveConverter);
		ConvertUtility.addConverter(double[].class, primitiveConverter);
		ConvertUtility.addConverter(boolean[].class, primitiveConverter);

		ConvertUtility.addConverter(boolean.class, new BoolConverter());
		ConvertUtility.addConverter(Boolean.class, new BoolConverter());
		
		ConvertUtility.addConverter(Date.class, new DateTimeConverter());
		ConvertUtility.addConverter(LocalDateTime.class, new LocalDateTimeConverter());
	}

	public static void addConverter(Class type,IObjectConverter converter){
        _converters.put(type, converter);
    }
	
	/**
	 * 获取对象对应的转换器
	 * @param obj
	 * @return
	 */
	public static IObjectConverter getConverter(Object obj){
		if(obj == null){
			return null;
		}
		for(Class objclass : _converters.keySet()){
			if(objclass.equals(obj.getClass())){
				return _converters.get(objclass);
			}
		}
		if(obj instanceof List || obj.getClass().isArray()){
			return new ListConverter();
		}else if(obj instanceof Map || obj instanceof Collection){
			return new JsonConverter();
		}

		return null;
	}
	
	/**
	 * 获取指定值的int型
	 * @param value 需转换的值
	 * @return
	 */
	public static int getValueAsInt(Object value, int defvalue){
		if(value == null){
			return defvalue;
		}
		if(value instanceof Integer){
			return ((Integer)value).intValue();
		}
		if(value instanceof BigInteger){
			return ((BigInteger)value).intValue();
		}
		if(value instanceof Double){
			Double v = (Double)value;
			BigDecimal dec = new BigDecimal(v);
			return dec.intValue();
		}
		if(value instanceof Float){
			Float v = (Float)value;
			BigDecimal dec = new BigDecimal(v);
			return dec.intValue();
		}
		if(value instanceof Boolean) {
			return (Boolean)value ? 1 : 0;
		}
		try{
			String str = value.toString();
			if(str.startsWith("0x") || str.startsWith("0X")){
				str = str.substring(2);
				return ByteUtility.toInt(str);
			}else{
				BigDecimal dec = new BigDecimal(value.toString());
				return dec.intValue();
			}
		}catch(Exception e){
			return defvalue;
		}
	}
	
	/**
	 * 转换成整形（转换失败则返回默认值0)
	 * @param value
	 * @return
	 */
	public static int getValueAsInt(Object value){
		return getValueAsInt(value, 0);
	}
	
	/**
	 * 转换成整形（转换失败则返回默认值-1)
	 * @param value
	 * @return
	 */
	public static int getValueAsIntWithNegativeDefault(Object value){
		return getValueAsInt(value, -1);
	}
	
	public static short getValueAsShort(Object value){
		if(value instanceof Short){
			return ((Short)value).shortValue();
		}
		if(value instanceof Double){
			Double v = (Double)value;
			return v.shortValue();
		}
		if(value instanceof Float){
			Float v = (Float)value;
			return v.shortValue();
		}
		if(value instanceof Boolean) {
			return (Boolean)value ? (short)1 : (short)0;
		}
		try{
			String str = value.toString();
			if(str.startsWith("0x") || str.startsWith("0X")){
				str = str.substring(2);
				return Short.parseShort(str, 16);
			}else{
				BigDecimal dec = new BigDecimal(value.toString());
				return dec.shortValue();
			}
		}catch(Exception e){
			return 0;
		}		
	}
	
	/**
	 * 获取uint32类型
	 * @param value 需转换的值
	 * @return
	 */
	public static long getValueAsUInt32(Object value, long defvalue){
		try{
			if(value == null){
				return defvalue;
			}
			String str = value.toString();
			long n = 0;
			if(str.startsWith("0x") || str.startsWith("0X")){
				str = str.substring(2);
				n = Long.parseLong(str, 16);
			}else{
				BigDecimal dec = new BigDecimal(value.toString());
				n = dec.longValue();
			}
			
			return 0x00000000ffffffffl & n;
		}catch(Exception e){
			return defvalue;
		}
    }
	
	public static long getValueAsUInt32(Object value){
		return getValueAsUInt32(value, 0);
	}
	
	/**
	 * 获取uint32类型
	 * @param value 需转换的值
	 * @return
	 */
	public static int getValueAsUInt(byte value)
    {
		return 0xff & value;
    }
	
	/**
	 * 获取uint32类型
	 * @param value 需转换的值
	 * @return
	 */
	public static int getValueAsUInt(short value)
    {
		return 0xffff & value;
    }
	
	/**
	 * 转换成整形（转换失败则返回默认值0)
	 * @param value
	 * @return
	 */
	public static int getValueAsIntWithBoolean(Object value){
		boolean b=getValueAsBool(value);
		
		return b?1:0;
	}
	
	
	/**
	 * 获取uint32类型
	 * @param value 需转换的值
	 * @return
	 */
	public static long getValueAsUInt(int value)
    {
		return 0x00000000ffffffffl & value;
    }
	
	/**
	 * 获取uint16类型
	 * @param value 需转换的值
	 * @return
	 */
	public static int getValueAsUInt16(Object value)
    {
		try{
			String str = value.toString();
			int n = 0;
			if(str.startsWith("0x") || str.startsWith("0X")){
				str = str.substring(2);
				n = Integer.parseInt(str, 16);
			}else{
				BigDecimal dec = new BigDecimal(value.toString());
				n = dec.intValue();
			}
			return 0xffff & n;
		}catch(Exception e){
			return 0;
		}
    }
	
	/**
	 * 获取uint8类型
	 * @param value 需转换的值
	 * @return
	 */
	public static short getValueAsUInt8(Object value)
	{
		try{
			String str = value.toString();
			short n = 0;
			if(str.startsWith("0x") || str.startsWith("0X")){
				str = str.substring(2);
				n = Short.parseShort(str, 16);
			}else{
				BigDecimal dec = new BigDecimal(value.toString());
				n = dec.shortValue();
			}
			int res = 0xff & n;
			return Integer.valueOf(res).shortValue();
		}catch(Exception e){
			return 0;
		}
	}
	
	public static byte getValueAsByte(Object value, byte defvalue){
		if(value instanceof Byte){
			return ((Byte)value).byteValue();
		}
		if(value instanceof Boolean) {
			return (Boolean)value ? (byte)1 : (byte)0;
		}
		try{
			String str = value.toString();
			if(str.startsWith("0x") || str.startsWith("0X")){
				str = str.substring(2);
				return ByteUtility.toByte(str);
			}else{
				BigDecimal dec = new BigDecimal(str);
				return dec.byteValue();
			}
		}catch(Exception e){
			return defvalue;
		}
	}
	
	public static byte getValueAsByte(Object value){
		return getValueAsByte(value, (byte)0);
	}
	
	public static byte[] getValueAsBytesBySerial(String value){ 
		try{
			String str = value.toString();
			String[] bystr = str.split(",");
			byte[] byt = new byte[bystr.length];
			if(bystr.length >= 2){
				for (int i = 0; i<  bystr.length ;i++) {
					if(bystr[i].startsWith("0x") || bystr[i].startsWith("0X")){
						bystr[i] = bystr[i].substring(2);
						byt[i] = ByteUtility.toByte(bystr[i]);
					}else{
						BigDecimal dec = new BigDecimal(bystr[i]);
						byt[i] = dec.byteValue();
					}
				}				
			}else {
				if(str.startsWith("0x") || str.startsWith("0X")){
					str = str.substring(2);
					byt[0] = ByteUtility.toByte(str);
				}else{
					BigDecimal dec = new BigDecimal(str);
					byt[0] = dec.byteValue();
				}
			}
			return  byt; 
		}catch(Exception e){
			return null;
		}
	}
		
	public static BigDecimal getValueAsBigDecimal(Object value){
		if(value == null || StringUtility.isNullOrEmpty(value)){
			return new BigDecimal("0");
		}
		
		if(value instanceof BigDecimal){
			return (BigDecimal) value;
		}
		try{
			String str = value.toString();
			if(str.contains(".")) {
				return new BigDecimal(str);
			}else {
				BigInteger n = getValueAsBigInteger(value);
				return new BigDecimal(n);
			}
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static BigInteger getValueAsBigInteger(Object value){
		if(value == null || StringUtility.isNullOrEmpty(value)){
			return new BigInteger("0");
		}
		
		if(value instanceof BigInteger){
			return (BigInteger) value;
		}
		try{
			String str = value.toString();
			if(str.startsWith("0x") || str.startsWith("0X")) {
				str = str.substring(2);
				BigInteger n = new BigInteger(str, 16);
				return n;
			}else {
				return new BigInteger(str);
			}
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static long getValueAsLong(Object value){
		return getValueAsLong(value, 0l);
	}
	
	/**
	 * 获取指定值的long型
	 * @param value 需转换的值
	 * @return
	 */
	public static long getValueAsLong(Object value, long defvalue){
		if(value instanceof Long){
			return ((Long)value).longValue();
		}
		if(value instanceof Double){
			Double v = (Double)value;
			BigDecimal dec = new BigDecimal(v);
			return dec.longValue();
		}
		if(value instanceof Float){
			Float v = (Float)value;
			BigDecimal dec = new BigDecimal(v);
			return dec.longValue();
		}
		if(value instanceof Boolean) {
			return (Boolean)value ? 1 : 0;
		}
		if(value instanceof Date) {
			Date dt = (Date) value;
			return dt.getTime();
		}
		try{
			String str = value.toString();
			if(str.startsWith("0x") || str.startsWith("0X")){
				str = str.substring(2);
				return ByteUtility.toLong(str);
			}else{
				BigDecimal dec = new BigDecimal(value.toString());
				return dec.longValue();
			}
		}catch(Exception e){
			return defvalue;
		}
	}
	
	/**
	 * 获得指定值的Float型，转换失败则返回0
	 * @param value 需转换的值
	 * @return
	 */
	public static float getValueAsFloat(Object value)
	{
		if(value instanceof Float){
			return ((Float)value).floatValue();
		}
		try{
			BigDecimal dec = new BigDecimal(value.toString());
			return dec.floatValue();
		}catch(Exception e){
			return 0;
		}
	}
	
	/**
	 * 获得指定值的double型，转换失败则返回0
	 * @param value 需转换的值
	 * @return
	 */
	public static double getValueAsDouble(Object value, double defvalue){
		if(value == null){
			return defvalue;
		}
		if(value instanceof Double){
			return ((Double)value).doubleValue();
		}
		try{
			BigDecimal dec = new BigDecimal(value.toString());
			return dec.doubleValue();
		}catch(Exception e){
			return defvalue;
		}
	}
	
	public static double getValueAsDouble(Object value){
		return getValueAsDouble(value, 0);
	}
	
	public static double getEtherValue(String value) {
		BigInteger n = new BigInteger(value);
		return getEtherValue(n);
	}
	
	public static double getEtherValue(BigInteger n) {
		return getEtherValueAsBigDecimal(n).doubleValue();
	}
	
	public static BigDecimal getEtherValueAsBigDecimal(BigInteger n) {
		String str = "1000000000000000000";
		BigDecimal d = new BigDecimal(str);
		BigDecimal dn = new BigDecimal(n);
		BigDecimal r = dn.divide(d);
		return r;
	}
	
	public static BigDecimal getEtherValueAsBigDecimal(String value) {
		BigInteger n = new BigInteger(value);
		return getEtherValueAsBigDecimal(n);
	}
	
	public static String getEtherWei(double n) {
		return getEtherWei(n + "");
	}
	
	public static String getEtherWei(String n) {
		long exp = 1000000000000000000l;
		BigDecimal dec = new BigDecimal(n);
		BigDecimal expn = new BigDecimal(exp + "");
		BigDecimal res = dec.multiply(expn);
		String str = res.toString();
		String[] parts = StringUtility.splitString(str, '.');
		return parts[0];
	}
		
	/**
	 * 获得指定值的string型，null则返回""
	 * @param value 需转换的值
	 * @return
	 */
	public static String getValueAsString(Object value){
        return getValueAsDecString(value);
	}
	
	public static String getValueAsHexString(Object value) {
        if (value == null) return "";
        IObjectConverter convert = getConverter(value);
        if (convert != null)
        {
            return convert.convertAsHexString(value, false);
        }
        
        return value.toString();
	}
	
	public static String getValueAsDecString(Object value){
        if (value == null) return "";
        IObjectConverter convert = getConverter(value);
        if (convert != null)
        {
            return convert.convertAsString(value);
        }
        
        return value.toString();
	}
	
	/**
	 * 获得指定值的bool型，如果value是"N"或者"FALSE"(不区分大小写)则返回False，否则返回True
	 * @param value 需转换的值
	 * @return
	 */
	public static boolean getValueAsBool(Object value)
	{
		return getValueAsBool(value, true);
	}
	
	/**
	 * 获得指定值的bool型，如果value是"N"或者"FALSE"(不区分大小写)则返回False，否则返回True
	 * @param value value 需转换的值
	 * @param defaultValue 默认值
	 * @return
	 */
	public static boolean getValueAsBool(Object value,boolean defaultValue) {
		OutParameter<Boolean> outValue = new OutParameter<Boolean>();
		if(isBool(value, outValue)) {
			return outValue.value;
		}
        return defaultValue;		
	}
	
	public static boolean isBool(Object value, OutParameter<Boolean> outValue){
        if (value instanceof Boolean) { 
        	if(outValue != null) {
        		outValue.value = (Boolean) value;
        	}
        	return true; 
        }
        
        String valueStr = getValueAsString(value).toUpperCase();
        if (valueStr.equalsIgnoreCase("N") || valueStr.equalsIgnoreCase("FALSE") || valueStr.equalsIgnoreCase("否") || valueStr.equalsIgnoreCase("关") 
        		|| valueStr.equalsIgnoreCase("NO") || valueStr.equals("0") || valueStr.equals("0.0") || valueStr.equalsIgnoreCase("OFF")
        		|| valueStr.equalsIgnoreCase("INACTIVE") || valueStr.equalsIgnoreCase("DISABLE")) { 
        	if(outValue != null) {
        		outValue.value = false;
        	}
        	return true;
        }
        
        if (valueStr.equalsIgnoreCase("Y") || valueStr.equalsIgnoreCase("TRUE") || valueStr.equalsIgnoreCase("是") || valueStr.equalsIgnoreCase("开")  
        		|| valueStr.equalsIgnoreCase("YES") || valueStr.equals("1") || valueStr.equals("1.0") || valueStr.equalsIgnoreCase("ON")
        		|| valueStr.equalsIgnoreCase("ACTIVE") || valueStr.equalsIgnoreCase("ENABLE")) { 
        	if(outValue != null) {
        		outValue.value = true;
        	}
        	return true;
        }
        
        return false;		
	}
	
	/**
	 * 获得指定值的日期类型
	 * @param value 需转换的值
	 * @return
	 */
	public static Date getValueAsDate(Object value){
		if(value == null){
			return null;
		}
		if(value instanceof Date){
			return (Date) value;
		}else if(value instanceof LocalDateTime){
			LocalDateTime dt = (LocalDateTime)value;
			Calendar cal = Calendar.getInstance();
			cal.set(Calendar.YEAR, dt.getYear());
			cal.set(Calendar.DAY_OF_YEAR, dt.getDayOfYear());
			cal.set(Calendar.HOUR_OF_DAY, dt.getHour());
			cal.set(Calendar.MINUTE, dt.getMinute());
			cal.set(Calendar.SECOND, dt.getSecond());
			cal.set(Calendar.MILLISECOND, dt.getNano()/1000);
			return cal.getTime();
		}else if(value instanceof Calendar){
			Calendar cal = (Calendar) value;
			return cal.getTime();
		}else if(value instanceof Long){
			Date dt = new Date();
			dt.setTime((Long)value);
			return dt;
		}
		try{
			String str = value.toString();
			if(StringUtility.isNumeric(str)){
				if(str.length() == 13){
					long ms = Long.valueOf(str);
					return FormatUtility.parseDateTime(ms);
				}else if(str.length() == 14){
					return FormatUtility.parseDateTime(value.toString(), "yyyyMMddHHmmss");
				}else if(str.length() == 12){
					return FormatUtility.parseDateTime(value.toString(), "yyyyMMddHHmm");
				}else if(str.length() == 10){
					return FormatUtility.parseDateTime(value.toString(), "yyyyMMddHH");
				}else if(str.length() == 8){
					return FormatUtility.parseDateTime(value.toString(), "yyyyMMdd");
				}else if(str.length() == 6){
					return FormatUtility.parseDateTime(value.toString(), "HHmmss");
				}
			}
			return FormatUtility.parseDateTime(value.toString(), "yyyy-MM-dd HH:mm:ss");
		}catch(Exception e){
			return FormatUtility.parseDateTime(value.toString(), "yyyy-MM-dd");
		}
	}
	
	public static LocalDateTime getValueAsLocalDateTime(Date dt) {
		Calendar cal = Calendar.getInstance();
		cal.setTime(dt);
		int y = cal.get(Calendar.YEAR);
		int m = cal.get(Calendar.MONTH);
		int d = cal.get(Calendar.DAY_OF_MONTH);
		int h = cal.get(Calendar.HOUR_OF_DAY);
		int min = cal.get(Calendar.MINUTE);
		int s = cal.get(Calendar.SECOND);
		LocalDateTime res = LocalDateTime.of(y, m, d, h, min, s);
		return res;
	}
	
	public static LocalDateTime getValueAsLocalDateTime(Object obj) {
		if(obj instanceof LocalDateTime) {
			return (LocalDateTime)obj;
		}
		Date dt = getValueAsDate(obj);
		return getValueAsLocalDateTime(dt);
	}
	
	public static String getValueAsMSJsonDateStr(Date date){
		if(date == null){
			return "";
		}
		long ms = date.getTime();
		StringBuilder sb = new StringBuilder();
		sb.append("/Date(");
		sb.append(ms).append(')').append('/');
		return sb.toString();
	}
	
	public static Date getValueAsDateFromMSJsonDateStr(String datestr){
		if(StringUtility.isNullOrEmpty(datestr)){
			return null;
		}
		int s = datestr.indexOf('(');
		int e = datestr.indexOf(')');
		String msstr = datestr.substring(s+1, e);
		long ms = getValueAsLong(msstr);
		Date dt = new Date();
		dt.setTime(ms);
    	return dt;		
	}
	
	public static Object getPrimitiveValue(Class type, Object value){
		try{
			Constructor cons = type.getConstructor(value.getClass());
			if(cons != null){
				return cons.newInstance(value);
			}
			Method meth = type.getMethod("valueOf", value.getClass());
			if(meth != null){
				return meth.invoke(null, value);
			}
			if(type.equals(Integer.class)){
				return getValueAsInt(value);
			}else if(type.equals(Byte.class)){
				return getValueAsByte(value);
			}else if(type.equals(Long.class)){
				return getValueAsLong(value);
			}else if(type.equals(Short.class)){
				return getValueAsShort(value);
			}else if(type.equals(Boolean.class)){
				return getValueAsBool(value);
			}else if(type.equals(Float.class)){
				return getValueAsFloat(value);
			}else if(type.equals(Double.class)){
				return getValueAsDouble(value);
			}else{
				return getValueAsString(value);
			}
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	/**
	 * 将object数组转换成string数组
	 * @param values 源数组
	 * @return 返回string类型的目标数组
	 */
	public static String[] toString(Object[] values)
	{
        String[] result = new String[values.length];
        for (int i = 0; i < result.length; i++) 
        	result[i] = getValueAsString(values[i]);
        
        return result;
		
	}
		
    /**
     * 把整形数字以大端模式转换为4个元素的字节数组。
     * 转换后的字节数组，高位在低索引。
     * @param n 
     * @return 4个字节的数组，高位在低索引。
     */
    public static byte[] toBigEndianBytes(int n){
		byte[] res = new byte[4];
		
		res[3] = (byte)((n & 0x000000FF));
		res[2] = (byte)((n & 0x0000FFFF) >>> 8);
		res[1] = (byte)((n & 0x00FFFFFF) >>> 16);
		res[0] = (byte)(n >>> 24);
		
		return res;
    }
    
    public static byte[] toBigEndianBytesCompact(int n){
    	byte[] data = toBigEndianBytes(n);
    	return compactBytes(data);
    }
    
    public static byte[] compactBytes(byte[] data){
    	int zerocount = 0;
    	for(int i=0; i<data.length && data[i] == 0; i++, zerocount++) ;
    	
    	int len = data.length - zerocount;
    	byte[] res = new byte[len];
    	
    	System.arraycopy(data, zerocount, res, 0, len);
    	return res;
    }

    public static byte[] toBigEndianBytes(long n){
		byte[] res = new byte[8];
		
		res[7] = (byte)((n & 0xFFL));
		res[6] = (byte)((n & 0xFFFFL) >>> 8);
		res[5] = (byte)((n & 0xFFFFFFL) >>> 16);
		res[4] = (byte)((n & 0xFFFFFFFFL) >>> 24);
		res[3] = (byte)((n & 0xFFFFFFFFFFL) >>> 32);
		res[2] = (byte)((n & 0xFFFFFFFFFFFFL) >>> 40);
		res[1] = (byte)((n & 0xFFFFFFFFFFFFFFL) >>> 48);
		res[0] = (byte)(n >>> 56);
		
		return res;
    }

    public static byte[] toBigEndianBytesCompact(long n){
    	byte[] data = toBigEndianBytes(n);
    	return compactBytes(data);
    }
    

    /**
     * 把整形数字以小端模式转换为4个元素的字节数组。
     * 转换后的字节数组，低位在低索引。
     * @param n 
     * @return 4个字节的数组，低位在低索引。
     */
    public static byte[] toLittleEndianBytes(int n){
		byte[] res = new byte[4];
		
		res[0] = (byte)((n & 0x000000FF));
		res[1] = (byte)((n & 0x0000FFFF) >>> 8);
		res[2] = (byte)((n & 0x00FFFFFF) >>> 16);
		res[3] = (byte)(n >>> 24);
		
		return res;
    }
    
    /**
     * 把字节数组以小端模式拼接为整形。
     * @param bytes
     * @return
     */
    public static int toIntByLittleEdian(byte[] bytes){
		int result = 0;
		for (int i = bytes.length - 1; i >= 0; i--)
		{
			int tmp = bytes[i] & 0x000000FF;
			result += tmp << (i * 8);
		}
		return result;    	
    }

    /**
     * 把字节数组以大端模式拼接为整形。
     * @param bytes
     * @return
     */
    public static int toIntByBigEdian(byte[] bytes){
		int result = 0;
		for (int i = 0; i < bytes.length; i++)
		{
			int tmp = bytes[i] & 0x000000FF;
			result += tmp << ((bytes.length - i - 1) * 8);
		}
		return result;    	
    }

    /**
     * 把字节的高低位进行对调。
     * @param n
     * @return
     */
	public static byte inverseByte(byte n){
		byte res = 0;
		res |= (byte) ((n << 7) & 0x80);
		res |= (byte) ((n >>> 7) & 0x01);
		res |= (byte) ((n << 5) & 0x40);
		res |= (byte) ((n >>> 5) & 0x02);
		res |= (byte) ((n << 3) & 0x20);
		res |= (byte) ((n >>> 3) & 0x04);
		res |= (byte) ((n << 1) & 0x10);
		res |= (byte) ((n >>> 1) & 0x08);
		
		return res;
	}
	
	/**
	 * 把整形数字中的每个字节进行高低位对调。整形中的字节序以小端模式为准（低位在低索引）
	 * @param n
	 * @return
	 */
	public static int inverseBytesByLittleEndian(int n){
		byte[] num = toLittleEndianBytes(n);
		for(int i=0; i<num.length; i++){
			num[i] = inverseByte(num[i]);
		}
		return toIntByLittleEdian(num);
	}

	/**
	 * 把整形数字中的每个字节进行高低位对调。整形中的字节序以大端模式为准（高位在低索引）
	 * @param n
	 * @return
	 */
	public static int inverseBytesByBigEndian(int n){
		byte[] num = toBigEndianBytes(n);
		for(int i=0; i<num.length; i++){
			num[i] = inverseByte(num[i]);
		}
		return toIntByBigEdian(num);
	}

	public static String toSerializeString(Object obj){
		try{
			ByteArrayOutputStream bs = new ByteArrayOutputStream();
			ObjectOutputStream so = new ObjectOutputStream(bs);
			so.writeObject(obj);
			so.flush();
			return SecurityUtility.base64(bs.toByteArray());
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static Object fromSerializeString(String str){
		try{
			byte[] data = SecurityUtility.fromBase64(str);
			ByteArrayInputStream bis = new ByteArrayInputStream(data);
			ObjectInputStream si = new ObjectInputStream(bis);
			return si.readObject();
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static boolean isLeap(Date date){
		Calendar cal = Calendar.getInstance();
		cal.setTime(date);
		int y = cal.get(Calendar.YEAR);
		
		if(y % 100 == 0){
			if(y % 400 == 0){
				return true;
			}
			return false;
		}
		
		return y % 4 == 0;
	}
	
	public static int getLastDayOfMonth(Date date){
		Calendar cal = Calendar.getInstance();
		cal.setTime(date);
		int n = cal.get(Calendar.MONTH);
		if(n == 1){
			if(isLeap(date)){
				return 29;
			}
			return 28;
		}
				
		if(n == 0 || n == 2 || n == 4 || n == 6 || n == 7 || n == 9 || n == 11){
			return 31;
		}
		return 30;
	}
	
	public static <T> Set<T> getValueAsSet(Object obj, Class<T> itemclz){
		if(obj instanceof String){
			return JsonUtility.decodeSet((String)obj, itemclz);
		}
		if(obj instanceof List){
			List tl = (List)obj;
			if(tl.isEmpty()){
				return new HashSet<T>();
			}
			if(tl.get(0).getClass().getName().equals(itemclz.getName())){
				List<T> list = (List<T>) obj;
				Set<T> set = new HashSet<T>();
				set.addAll(list);
				return set;
			}else{
				Set<T> set = new HashSet<T>();
				if(itemclz.isPrimitive()){
					for(Object item : tl){
						Object o = getPrimitiveValue(itemclz, item);
						set.add((T)o);
					}
				}else{
					for(Object item : tl){
						set.add((T)item);
					}
				}
				return set;
			}
		}
		if(obj instanceof Set){
			return (Set<T>) obj;
		}
		
		throw new RuntimeException("cannot.convert.to.set");
	}
	
	
	
	private static class DateTimeConverter implements IObjectConverter{

		private static final long serialVersionUID = 3154457975794736749L;

		@Override
		public String convertAsString(Object obj) {
            if (obj instanceof Date) return FormatUtility.formatDateTime((Date)obj, "yyyy-MM-dd HH:mm:ss");
            return null;
		}
		
	}
	
	private static class LocalDateTimeConverter implements IObjectConverter{

		private static final long serialVersionUID = 3154457975794736749L;

		@Override
		public String convertAsString(Object obj) {
            if (obj instanceof LocalDateTime) 
            	return FormatUtility.formatDateTime((LocalDateTime)obj, "yyyy-MM-dd HH:mm:ss");
            return null;
		}
		
	}
	
	private static class PrimitiveArrayConverter implements IObjectConverter
	{

		private static final long serialVersionUID = 4081785542665022007L;

		@Override
		public String convertAsString(Object obj) {
			if(obj == null){
				return null;
			}
            StringBuilder sb = new StringBuilder();
            if (obj instanceof byte[])
            {
                byte[] bytes = (byte[]) obj;
                for (byte c : bytes)
                {
                    sb.append(getValueAsUInt(c)).append(",");
                }
                if(sb.length() == 0){
                	return "";
                }
                return sb.substring(0, sb.length()-1);
                
            }else if(obj instanceof int[]){
            	int[] bytes = (int[]) obj;
                for (int c : bytes)
                {
                    sb.append(getValueAsUInt(c)).append(",");
                }
                if(sb.length() == 0){
                	return "";
                }
                return sb.substring(0, sb.length()-1);
            	
            }else if(obj instanceof short[]){
            	short[] bytes = (short[]) obj;
                for (short c : bytes)
                {
                    sb.append(getValueAsUInt(c)).append(",");
                }
                if(sb.length() == 0){
                	return "";
                }
                return sb.substring(0, sb.length()-1);
            	
            }else if(obj instanceof long[]){
            	long[] bytes = (long[]) obj;
                for (long c : bytes)
                {
                    sb.append(c).append(",");
                }
                if(sb.length() == 0){
                	return "";
                }
                return sb.substring(0, sb.length()-1);
            	
            }else if(obj instanceof float[]){
            	float[] bytes = (float[]) obj;
                for (float c : bytes)
                {
                    sb.append(c).append(",");
                }
                if(sb.length() == 0){
                	return "";
                }
                return sb.substring(0, sb.length()-1);
            	
            }else if(obj instanceof double[]){
            	double[] bytes = (double[]) obj;
                for (double c : bytes)
                {
                    sb.append(c).append(",");
                }
                if(sb.length() == 0){
                	return "";
                }
                return sb.substring(0, sb.length()-1);
            	
            }else if(obj instanceof boolean[]){
            	boolean[] bytes = (boolean[]) obj;
                for (boolean c : bytes)
                {
                    sb.append(c).append(",");
                }
                if(sb.length() == 0){
                	return "";
                }
                return sb.substring(0, sb.length()-1);
            	
            }
            return null;
		}
		
		@Override
		public String convertAsHexString(Object obj, boolean with0x) {
			if(obj == null){
				return null;
			}
            StringBuilder sb = new StringBuilder();
            if (obj instanceof byte[])
            {
                byte[] bytes = (byte[]) obj;
                for(byte c : bytes){
                	sb.append(StringUtility.toHex(c, with0x)).append(",");
                }
                if(sb.length() == 0){
                	return "";
                }
                return sb.substring(0, sb.length()-1);
                
            }else if(obj instanceof int[]){
            	int[] bytes = (int[]) obj;
                for(int c : bytes){
                	sb.append(StringUtility.toHex(c, with0x)).append(",");
                }
                if(sb.length() == 0){
                	return "";
                }
                return sb.substring(0, sb.length()-1);
            	
            }else if(obj instanceof short[]){
            	short[] bytes = (short[]) obj;
                for(short c : bytes){
                	sb.append(StringUtility.toHex(c, with0x)).append(",");
                }
                if(sb.length() == 0){
                	return "";
                }
                return sb.substring(0, sb.length()-1);
            	
            }else if(obj instanceof long[]){
            	long[] bytes = (long[]) obj;
                for(long c : bytes){
                	sb.append(StringUtility.toHex(c, with0x)).append(",");
                }
                if(sb.length() == 0){
                	return "";
                }
                return sb.substring(0, sb.length()-1);
            	
            }else if(obj instanceof float[]){
            	float[] bytes = (float[]) obj;
                for (float c : bytes){
                    sb.append(c).append(",");
                }
                if(sb.length() == 0){
                	return "";
                }
                return sb.substring(0, sb.length()-1);
            	
            }else if(obj instanceof double[]){
            	double[] bytes = (double[]) obj;
                for (double c : bytes){
                    sb.append(c).append(",");
                }
                if(sb.length() == 0){
                	return "";
                }
                return sb.substring(0, sb.length()-1);
            	
            }else if(obj instanceof boolean[]){
            	boolean[] bytes = (boolean[]) obj;
                for (boolean c : bytes){
                    sb.append(c).append(",");
                }
                if(sb.length() == 0){
                	return "";
                }
                return sb.substring(0, sb.length()-1);
            	
            }
            return null;
		}
		
	}
	
	private static class BoolConverter implements IObjectConverter{

		private static final long serialVersionUID = -3547556942163508067L;

		@Override
		public String convertAsString(Object obj) {
			if(obj != null){
				String str = obj.toString();
				boolean res = Boolean.valueOf(str);
				return res ? "1" : "0";
			}
			
            return null;
		}
		
	}
	
	private static class JsonConverter implements IObjectConverter{
		private static final long serialVersionUID = 5529230007853913473L;

		@Override
		public String convertAsString(Object obj) {
			if(obj != null){
				try{
					String str = JsonUtility.encode(obj);
					return str;
				}catch(Exception e){					
				}
			}
			return null;
		}
		
	}
	
	private static class ListConverter implements IObjectConverter{
		private static final long serialVersionUID = 5529230007853913473L;

		@Override
		public String convertAsString(Object obj) {
			if(obj != null){
				try{
					String str = JsonUtility.encode(obj);
					str = str.substring(1);
					str = str.substring(0, str.length()-1);
					return str;
				}catch(Exception e){					
				}
			}
			return null;
		}
		
	}
	
	
	
	public static void main(String[] args){
		int n = 0x0000000865;
		System.out.println(StringUtility.toBinaryStringByLittleEdian(n, '.') + "\n");
		byte[] num = toLittleEndianBytes(n);
		for(int i=0; i<num.length; i++){
			num[i] = inverseByte(num[i]);
			System.out.println(StringUtility.toBinaryString(num[i]));
		}
		
		System.out.println();
		byte b = (byte)0xa6;
		System.out.println(b);
		System.out.println(0xa6);
		
		int result = 0;
		for (int i = num.length - 1; i >= 0; i--)
		{
			System.out.println(StringUtility.toBinaryString(num[i]));
			int tmpn = num[i] & 0x000000FF;;
			int tmp = tmpn << (i * 8);
			System.out.println(tmp);
			result += tmp;
			System.out.println(result + "\n");
		}
		System.out.println(Integer.toBinaryString(result));
		System.out.println(StringUtility.toBinaryStringByLittleEdian(result, '.') + "\n");
		
		BigInteger gasprice = ConvertUtility.getValueAsBigInteger("0x430e23400");
		BigInteger gasused = ConvertUtility.getValueAsBigInteger("0xd298");
		BigInteger gas = gasprice.multiply(gasused);
		double gasether = ConvertUtility.getEtherValue(gas);
		System.out.println(String.format("%s, %s, %s, %s", gasprice, gasused, gas, gasether+""));
		
		double amt = 10.0;
		String amtwei = ConvertUtility.getEtherWei(amt);
		System.out.println(amtwei);
	}
	
}
