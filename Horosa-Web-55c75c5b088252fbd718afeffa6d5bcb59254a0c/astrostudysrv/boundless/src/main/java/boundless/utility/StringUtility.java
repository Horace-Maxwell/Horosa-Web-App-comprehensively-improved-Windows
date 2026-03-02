package boundless.utility;

import java.io.StringReader;
import java.lang.reflect.Array;
import java.sql.Types;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

import org.unbescape.html.HtmlEscape;
import org.unbescape.html.HtmlEscapeLevel;
import org.unbescape.html.HtmlEscapeType;

import net.sourceforge.pinyin4j.PinyinHelper;
import net.sourceforge.pinyin4j.format.HanyuPinyinCaseType;
import net.sourceforge.pinyin4j.format.HanyuPinyinOutputFormat;
import net.sourceforge.pinyin4j.format.HanyuPinyinToneType;
import net.sourceforge.pinyin4j.format.HanyuPinyinVCharType;
import net.sourceforge.pinyin4j.format.exception.BadHanyuPinyinOutputFormatCombination;
import java.util.regex.Matcher;

/**
 * 字符串分割工具类
 * @author zjf
 *
 */
public class StringUtility {

	/**
	 * 逗号
	 */
	public static final char CHAR_COMMA = ',';
	
	/**
	 * 竖号
	 */
	public static final char CHAR_VERTICAL = '|';
	
	/**
	 * 分号
	 */
	public static final char CHAR_SEMICOLON = ';';
	
	/**
	 * 冒号
	 */
	public static final char CHAR_COLON = ':';

	public static final String EmailRegex = "(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|\"(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21\\x23-\\x5b\\x5d-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])*\")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21-\\x5a\\x53-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])+)\\])";
	private static final Pattern EmailPattern = Pattern.compile(EmailRegex); 
	
	private static final NumberFormat numFormat = NumberFormat.getNumberInstance();
	

	/**
	 * 分割字符串，忽略无效的数字 （字符串格式： "1,44,25,...,32"，分隔符自定义）
	 * @param text 文本
	 * @param sign 分隔符
	 * @return
	 */
    public static int[] splitInt32(String text, char sign)
    {
    	if(StringUtility.isNullOrEmpty(text)){
    		return new int[0];
    	}
    	
        List<Integer> values = new ArrayList<Integer>();
        int temp;
        String[] splits;
        try{
        	splits = text.split("\\" + sign);
        }catch(Exception e){
        	splits = text.split("" + sign);
        }
        for (String item : splits){
        	if(StringUtility.isNullOrEmpty(item)){
        		continue;
        	}
        	try{
            	temp = Integer.valueOf(item); 
                values.add(temp);
        	}catch(Exception e){
        	}
        }
        int[] res = new int[values.size()];
        for(int i=0; i<res.length; i++){
        	res[i] = values.get(i);
        }
        return res;
    }
   
	/**
	 * 分割字符串，忽略无效的数字 （字符串格式： "1,44,25,...,32"，分隔符自定义）
	 * @param text 文本
	 * @param sign 分隔符
	 * @return
	 */
    public static long[] splitUInt32(String text, char seperator){
    	if(StringUtility.isNullOrEmpty(text)){
    		return new long[0];
    	}
    	
        List<Long> values = new ArrayList<Long>();
        long temp;
        String[] splits;
        try{
        	splits = text.split("\\" + seperator);
        }catch(Exception e){
        	splits = text.split("" + seperator);
        }
        for (String item : splits){
        	if(StringUtility.isNullOrEmpty(item)){
        		continue;
        	}
        	try{
            	temp = Long.valueOf(item); 
                values.add(temp);
        	}catch(Exception e){
        	}
        }
        long[] res = new long[values.size()];
        for(int i=0; i<res.length; i++){
        	res[i] = values.get(i);
        }
        return res;
    }
    
    /**
     * 分割字符串，忽略空串
     * @param text
     * @param sign
     * @return
     */
    public static String[] splitString(String text, char sign){
    	if(StringUtility.isNullOrEmpty(text)){
    		return new String[0];
    	}
        List<String> values = new ArrayList<String>();
        String[] splits;
        try{
        	splits = text.split(String.format("[%c]", sign));
        	if(splits.length == 0) {
        		splits = text.split("" + sign);
        	}
        	if(splits.length == 0) {
        		splits = text.split("\\" + sign);
        	}
        }catch(Exception e){
        	splits = text.split("" + sign);
        }
        for (String item : splits){
            if (item.trim().length() > 0)
            {
                values.add(item.trim());
            }
        }
        String[] res = new String[values.size()];
        return values.toArray(res);
    }
    
    public static String[] splitString(String text, char[] signs){
    	if(StringUtility.isNullOrEmpty(text)){
    		return new String[0];
    	}
    	StringBuilder regex = new StringBuilder("[");
    	for(int i=0; i<signs.length; i++){
    		char c = signs[i];
    		regex.append(c);
    		if(c == '\\') {
    			regex.append(c);
    		}
    		if(i < signs.length - 1){
        		regex.append('|');
    		}
    	}
    	regex.append(']');
    	
        List<String> values = new ArrayList<String>();
        String[] splits = text.split(regex.toString());
        for (String item : splits){
            if (item.trim().length() > 0){
                values.add(item.trim());
            }
        }
        String[] res = new String[values.size()];
        return values.toArray(res);
  	
    }
    
    /**
     * 分割字符串，忽略无效的数字 （字符串格式： "1,44,25,...,32"，分隔符自定义）
     * @param text 文本
     * @param sign 分隔符
     * @return
     */
    public static float[] splitFloat(String text, char sign){
    	if(StringUtility.isNullOrEmpty(text)){
    		return new float[0];
    	}
    	
        List<Float> values = new ArrayList<Float>();
        float temp;
        String[] splits;
        try{
        	splits = text.split("\\" + sign);
        }catch(Exception e){
        	splits = text.split("" + sign);
        }
        for (String item : splits){
        	if(StringUtility.isNullOrEmpty(item)){
        		continue;
        	}
        	try{
            	temp = Float.valueOf(item); 
                values.add(temp);
        	}catch(Exception e){
        	}
        }
        float[] res = new float[values.size()];
        for(int i=0; i<res.length; i++){
        	res[i] = values.get(i);
        }
        return res;
    }
    
    public static Set<Long> splitToLongSet(String text, char sign){
    	Set<Long> set = new HashSet<Long>();
    	if(StringUtility.isNullOrEmpty(text)){
    		return set;
    	}
    	long temp;
        String[] splits;
        try{
        	splits = text.split("\\" + sign);
        }catch(Exception e){
        	splits = text.split("" + sign);
        }
        for (String item : splits){
        	if(StringUtility.isNullOrEmpty(item)){
        		continue;
        	}
        	try{
            	temp = Long.valueOf(item); 
                set.add(temp);
        	}catch(Exception e){
        	}
        }
    	
    	return set;
    }
    
    public static Set<Integer> splitToIntSet(String text, char sign){
    	Set<Integer> set = new HashSet<Integer>();
    	if(StringUtility.isNullOrEmpty(text)){
    		return set;
    	}
    	int temp;
        String[] splits;
        try{
        	splits = text.split("\\" + sign);
        }catch(Exception e){
        	splits = text.split("" + sign);
        }
        for (String item : splits){
        	if(StringUtility.isNullOrEmpty(item)){
        		continue;
        	}
        	try{
            	temp = Integer.valueOf(item); 
                set.add(temp);
        	}catch(Exception e){
        	}
        }
    	
    	return set;
    }
    
    public static Set<Double> splitToDoubleSet(String text, char sign){
    	Set<Double> set = new HashSet<Double>();
    	if(StringUtility.isNullOrEmpty(text)){
    		return set;
    	}
    	double temp;
        String[] splits;
        try{
        	splits = text.split("\\" + sign);
        }catch(Exception e){
        	splits = text.split("" + sign);
        }
        for (String item : splits){
        	if(StringUtility.isNullOrEmpty(item)){
        		continue;
        	}
        	try{
            	temp = Double.valueOf(item); 
                set.add(temp);
        	}catch(Exception e){
        	}
        }
    	
    	return set;
    }
    
    public static Set<String> splitToStringSet(String text, char sign){
    	Set<String> set = new HashSet<String>();
    	if(StringUtility.isNullOrEmpty(text)){
    		return set;
    	}
        String[] splits;
        try{
        	splits = text.split("\\" + sign);
        }catch(Exception e){
        	splits = text.split("" + sign);
        }
        for (String item : splits){
        	if(StringUtility.isNullOrEmpty(item)){
        		continue;
        	}
            set.add(item);
        }
    	
    	return set;
    }
    
    /**
     * 判断字符串是否为空
     * @param str
     * @return
     */
    public static boolean isNullOrEmpty(String str){
    	if(str == null || str.length() == 0){
    		return true;
    	}
    	return false;
    }
    
    public static boolean isNullOrEmpty(Object obj){
    	if(obj instanceof String){
    		return isNullOrEmpty((String)obj);
    	}
    	if(obj == null){
    		return true;
    	}
    	
    	return false;
    }
    
    public static String toHex(byte n){
    	return toHex(n, false);
    }
    
    public static String toHex(int n){
    	return toHex(n, false);
    }
    
    public static String toHex(short n){
    	return toHex(n, false);
    }
    
    public static String toHex(byte n, boolean with0x){
    	if(with0x){
    		return String.format("0x%02X", n);
    	}
    	return String.format("%02X", n);
    }
    
    public static String toHex(long n, boolean with0x){
    	if(with0x){
    		return String.format("0x%016X", n);
    	}
    	return String.format("%016X", n);
    }
    
    public static String toHex(int n, boolean with0x){
    	if(with0x){
    		return String.format("0x%08X", n);
    	}
    	return String.format("%08X", n);
    }
    
    public static String toHex(short n, boolean with0x){
    	if(with0x){
    		return String.format("0x%04X", n);
    	}
    	return String.format("%04X", n);
    }
    
    public static String toHex(byte[] values, boolean with0x){
		StringBuilder res = new StringBuilder(" ");
		if(values == null){
			return "";
		}
		for(byte value : values){
			res.append(StringUtility.toHex(value, with0x)).append(" ");
		}
		return res.toString();
    }
    
    public static String toHex(int[] values, boolean with0x){
		StringBuilder res = new StringBuilder(" ");
		for(int value : values){
			res.append(StringUtility.toHex(value, with0x)).append(" ");
		}
		return res.toString();
    }
    
    public static String toHex(short[] values, boolean with0x){
		StringBuilder res = new StringBuilder(" ");
		for(short value : values){
			res.append(StringUtility.toHex(value, with0x)).append(" ");
		}
		return res.toString();
    }
    
    public static String toHex(long[] values, boolean with0x){
		StringBuilder res = new StringBuilder(" ");
		for(long value : values){
			res.append(StringUtility.toHex(value, with0x)).append(" ");
		}
		return res.toString();
    }
    
    public static String toHex(byte[] values){
    	return toHex(values, false);
    }
    
    public static String toHex(byte[] values, int length){
    	if(values.length <= length){
    		return toHex(values);
    	}
    	
    	byte[] data = new byte[length];
    	System.arraycopy(values, 0, data, 0, length);
    	return toHex(data);
    }
    
    /**
     * 把字节转换为2进制字符串
     * @param n
     * @return
     */
    public static String toBinaryString(byte n){
    	StringBuilder sb = new StringBuilder();
    	sb.append(Math.abs(n >> 7)).append(Math.abs((n >> 6) & 1)).append(Math.abs((n >> 5) & 1)).append(Math.abs((n >> 4) & 1));
    	sb.append(Math.abs((n >> 3) & 1)).append(Math.abs((n >> 2) & 1)).append(Math.abs((n >> 1) & 1)).append(Math.abs(n & 1));
    	return sb.toString();
    }
    
    /**
     * 把整形数字转换为2进制字符串，每个字节间以指定的分隔符进行分隔。字节序以大端模式为准
     * @param n
     * @param seperator 分隔符
     * @return
     */
    public static String toBinaryStringByBigEdian(int n, char seperator){
    	byte[] bytes = ConvertUtility.toBigEndianBytes(n);
    	StringBuilder sb = new StringBuilder();
    	for(int i=0; i<bytes.length; i++){
    		sb.append(toBinaryString(bytes[i])).append(seperator);
    	}
    	return sb.toString().substring(0, sb.length() - 1);
    }
    
    /**
     * 把整形数字转换为2进制字符串，每个字节间以指定的分隔符进行分隔。字节序以小端模式为准
     * @param n
     * @param seperator 分隔符
     * @return
     */
    public static String toBinaryStringByLittleEdian(int n, char seperator){
    	byte[] bytes = ConvertUtility.toLittleEndianBytes(n);
    	StringBuilder sb = new StringBuilder();
    	for(int i=0; i<bytes.length; i++){
    		sb.append(toBinaryString(bytes[i])).append(seperator);
    	}
    	return sb.toString().substring(0, sb.length() - 1);
    }
    
    /**
     * 把字符串数字以大端模式转换为4个元素的字节数组。字符串数字可以是10进制，16进制(0x, 0X, #为前导符合)，8进制(0为前导符号)数字字符串，
     * 转换后的字节数组，高位在低索引。
     * @param numStr 10进制，16进制(0x, 0X, #为前导符合)，8进制(0为前导符号)数字字符串
     * @return 4个字节的数组，高位在低索引。
     */
    public static byte[] toBigEndianBytes(String numStr){
    	Integer num = Integer.decode(numStr);
    	int n = num.intValue();
    	
		return ConvertUtility.toBigEndianBytes(n);
    }
    
    /**
     * 把字符串数字以小端模式转换为4个元素的字节数组。字符串数字可以是10进制，16进制(0x, 0X, #为前导符合)，8进制(0为前导符号)数字字符串，
     * 转换后的字节数组，低位在低索引。
     * @param numStr 10进制，16进制(0x, 0X, #为前导符合)，8进制(0为前导符号)数字字符串
     * @return 4个字节的数组，低位在低索引。
     */
    public static byte[] toLittleEndianBytes(String numStr){
    	Integer num = Integer.decode(numStr);
    	int n = num.intValue();
    			
		return ConvertUtility.toLittleEndianBytes(n);
    }
    
    
    public static String toSqlTypeString(int type){
		switch(type){
		case Types.ARRAY: return "ARRAY";
		case Types.BIGINT: return "BIGINT";
		case Types.BINARY: return "BINARY";
		case Types.BIT: return "BIT";
		case Types.BLOB: return "BLOB";
		case Types.BOOLEAN: return "BOOLEAN";
		case Types.CHAR: return "CHAR";
		case Types.CLOB: return "CLOB";
		case Types.DATALINK: return "DATALINK";
		case Types.DATE: return "DATE";
		case Types.DECIMAL: return "DECIMAL";
		case Types.DISTINCT: return "DISTINCT";
		case Types.DOUBLE: return "DOUBLE";
		case Types.FLOAT: return "FLOAT";
		case Types.INTEGER: return "INTEGER";
		case Types.JAVA_OBJECT: return "JAVA_OBJECT";
		case Types.LONGNVARCHAR: return "LONGNVARCHAR";
		case Types.LONGVARBINARY: return "LONGVARBINARY";
		case Types.LONGVARCHAR: return "LONGVARCHAR";
		case Types.NCHAR: return "NCHAR";
		case Types.NCLOB: return "NCLOB";
		case Types.NULL: return "NULL";
		case Types.NUMERIC: return "NUMERIC";
		case Types.NVARCHAR: return "NVARCHAR";
		case Types.OTHER: return "OTHER";
		case Types.REAL: return "REAL";
		case Types.REF: return "REF";
		case Types.REF_CURSOR: return "REF_CURSOR";
		case Types.ROWID: return "ROWID";
		case Types.SMALLINT: return "SMALLINT";
		case Types.SQLXML: return "SQLXML";
		case Types.STRUCT: return "STRUCT";
		case Types.TIME: return "TIME";
		case Types.TIME_WITH_TIMEZONE: return "TIME_WITH_TIMEZONE";
		case Types.TIMESTAMP: return "TIMESTAMP";
		case Types.TIMESTAMP_WITH_TIMEZONE: return "TIMESTAMP_WITH_TIMEZONE";
		case Types.TINYINT: return "TINYINT";
		case Types.VARBINARY: return "VARBINARY";
		case Types.VARCHAR: return "VARCHAR";
		}
		
		return "UNKNOWN";
    	
    }
    
    public static String join(Object... args){
    	return joinWithSeperator("", args);
    }
    
    public static String joinWithSeperator(String seperator, Object... args){
    	if(args == null || args.length == 0){
    		return null;
    	}
    	String sep = seperator == null ? "" : seperator;
    	
    	int paramslen = args.length;
    	int paramidx = 0;
    	StringBuilder sb = new StringBuilder();
    	for(Object obj : args){
    		if(obj.getClass().isArray()){
    			int len = Array.getLength(obj);
    			for(int i=0; i<len; i++){
        			Object v = Array.get(obj, i);
        			String str = joinWithSeperator(sep, v);
        			if(str != null){
            			if(i < len-1){
            				sb.append(str).append(sep);
            			}else{
            				sb.append(str);
            			}
        			}
    			} 
    			
    		}else if(obj instanceof Collection){
    			Collection col = (Collection)obj;
    			int len = col.size();
    			int i = 0;
    			for(Object elem : col){
    				String str = joinWithSeperator(sep, elem);
        			if(str != null){
            			if(i < len-1){
            				sb.append(str).append(sep);
            			}else{
            				sb.append(str);
            			}
        			}
        			i++;
    			}
    			
    		}else{
    			if(obj != null){
					sb.append(obj.toString());
    			}
    		}
    		if(paramidx < paramslen - 1){
    			sb.append(sep);
    		}
    		paramidx++;
    	}
    	
    	return sb.toString();
    }
    
    public static String joinWithQuotation(List list) {
		StringBuilder sb = new StringBuilder();
		for(Object obj : list) {
			sb.append("'").append(obj.toString()).append("'").append(',');
		}
		return sb.substring(0, sb.length()-1);
    }
    
    public static String trim(String str,char[] chars){
    	int startIndex=0;
    	for(int i=0;i<str.length();i++){
    		char c=str.charAt(i);
    		int j=0;
    		for(;j<chars.length;j++) {
    			if (chars[j]==c) {
    				break;
    			}
    		}
    		if (j>=chars.length) {
    			startIndex=i;
    			break;
    		}
    	}
    	
    	int endIndex=str.length()-1;
    	for(int i=str.length()-1;i>=0;i--){
    		char c=str.charAt(i);
    		int j=0;
    		for(;j<chars.length;j++) {
    			if (chars[j]==c) {
    				break;
    			}
    		}
    		if (j>=chars.length) {
    			endIndex=i;
    			break;
    		}
    	}
    	
    	return str.substring(startIndex, endIndex+1);
    }
    
    public static boolean equals(String one,String another) {
    	if (one==another) return true;
		return one!=null && another!=null && one.equals(another);
	}
    

    public static byte[] getBytes(String str, String charset, int length, byte fillStub){
    	try{
    		byte[] data = str.getBytes(charset);
    		byte[] res = new byte[length];
    		int len = data.length > length ? length : data.length;
    		System.arraycopy(data, 0, res, 0, len);
    		if(len < length){
    			Arrays.fill(res, len, length, fillStub);
    		}
    		return res;
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}
    }
    
    public static String getBytesHexString(String str, String charset){
    	try{
    		byte[] data = str.getBytes(charset);
    		StringBuilder sb = new StringBuilder();
    		for(byte b : data){
    			sb.append(String.format("0x%02X ", b));
    		}
    		return sb.toString();
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}
    }
    
    public static String toString(String str, int length, char filler, boolean beforefill){
    	int delta = length - str.length();
    	if(delta <= 0){
    		return str;
    	}
    	StringBuilder sb = new StringBuilder();
    	if(beforefill){
        	for(int i=0; i<delta; i++){
        		sb.append(filler);
        	}
        	sb.append(str);
    	}else{
        	sb.append(str);
        	for(int i=0; i<delta; i++){
        		sb.append(filler);
        	}
    	}
    	return sb.toString();
    }
    
    public static String toString(long n, int length, char filler, boolean beforefill){
    	String str = n + "";
    	return toString(str, length, filler, beforefill);
    }
    
    public static String toFormatString(long n){
    	return numFormat.format(n);
    }

    public static String toFormatString(double n){
    	return numFormat.format(n);
    }

    public static String toPinYin(String str, boolean onlyfirstchar){
    	if(isNullOrEmpty(str)) {
    		return "";
    	}
    	StringBuilder py = new StringBuilder();  
    	String[] t = new String[str.length()];  

    	char [] hanzi=new char[str.length()];  
    	for(int i=0;i<str.length();i++){  
    		hanzi[i]=str.charAt(i);  
    	}  

    	HanyuPinyinOutputFormat t1 = new HanyuPinyinOutputFormat();  
    	t1.setCaseType(HanyuPinyinCaseType.LOWERCASE);  
    	t1.setToneType(HanyuPinyinToneType.WITHOUT_TONE);  
    	t1.setVCharType(HanyuPinyinVCharType.WITH_V);  

    	try {  
    		for (int i = 0; i < str.length(); i++) {  
    			if ((str.charAt(i) >= 'a' && str.charAt(i) < 'z')  
    					|| (str.charAt(i) >= 'A' && str.charAt(i) <= 'Z')  
    					|| (str.charAt(i) >= '0' && str.charAt(i) <= '9')) {  
    				py.append(str.charAt(i));
    			} else {  
    				t = PinyinHelper.toHanyuPinyinStringArray(hanzi[i], t1);  
    				if(t.length == 0){
    					py.append(hanzi[i]);
    				}else{
        				py.append(onlyfirstchar ? t[0].substring(0, 1) : t[0]);
    				}
    			}  
    		}  
    	} catch (BadHanyuPinyinOutputFormatCombination e) {  
    		e.printStackTrace();  
    	}  

    	return py.toString();  
    }
    
    public static String toPinYin(String str){
    	return toPinYin(str, false);
    }
    
    public static String replaceBackSlash(String str){
    	StringBuilder sb = new StringBuilder();
    	try{
    		for(int i=0; i<str.length(); i++){
    			char c = str.charAt(i);
    			if(c == 8){
    				sb.append("/b");
    			}else if(c == 9){
    				sb.append("/t");
    			}else if(c == 12){
    				sb.append("/f");
    			}else if(c == 10){
    				sb.append("/n");
    			}else if(c == 13){
    				sb.append("/r");
    			}else if(c == 92){
    				sb.append("/");
    			}else{
    				sb.append(c);
    			}
    		}
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}
    	
    	return sb.toString();
    }

    public static String trimStart(String target, String trimString)
    {
        String result = target;
        while (result.startsWith(trimString))
        {
            result = result.substring(trimString.length());
        }

        return result;
    }
    public static String trimEnd(String target, String trimString)
    {
        String result = target;
        while (result.endsWith(trimString))
        {
            result = result.substring(0, result.length() - trimString.length());
        }

        return result;
    }
    
    public static String toFileSize(long size){
        if (size < 0x400L){
            return String.format("%dByte", size);
        }
        if ((size >= 0x400L) && (size <= 0x100000L)){
        	String res = String.format("%.2f", size * 1.0 / 0x400L);
        	res = trimEnd(res, "0");
            return trimEnd(res, ".") + "KB";
        }
        if ((size >= 0x100000L) && (size <= 0x40000000L)){
        	String res = String.format("%.2f", size * 1.0 / 0x100000L);
        	res = trimEnd(res, "0");
            return trimEnd(res, ".") + "MB";
        }
        if (size >= 0x40000000L){
        	String res = String.format("%.2f", size * 1.0 / 0x40000000L);
        	res = trimEnd(res, "0");
            return trimEnd(res, ".") + "GB";
        }
        return "";
    	
    }
    
    public static boolean isNumeric(String str){
    	if(str.length() > 20) {
    		return false;
    	}
    	String tmpstr = str.trim();
    	boolean foundpoint = false;
    	boolean foundsym = false;
    	int len = tmpstr.length();
    	for(int i = 0; i < len; i++){
    		char c = tmpstr.charAt(i);
    		if(c == '.'){
    			if(foundpoint || i==0 || i==len-1){
    				return false;
    			}
    			foundpoint = true;
    			continue;
    		}
    		if(c == '+' || c == '-'){
    			if(foundsym || i > 0 || len == 1){
    				return false;
    			}
    			foundsym = true;
    			continue;
    		}
    		if(!Character.isDigit(c)){
    			return false;
    		}
    	}
    	return true;
    }
    
    public static boolean isEmail(String str){
    	return EmailPattern.matcher(str).matches();
    }
    
    public static String getUUID(){
    	return UUID.randomUUID().toString().replace("-", "");
    }
    
    public static Map<String, String> parseQueryString(String str){
    	Map<String, String> map = new HashMap<String, String>();
    	String[] parts = splitString(str, '&');
    	for(String txt : parts){
    		String[] kv = splitString(txt, '=');
    		map.put(kv[0], kv[1]);
    	}
    	
    	return map;
    }
    
    public static String decodeHtml(String str){
    	if(str == null){
    		return "";
    	}
    	String unescaped = HtmlEscape.unescapeHtml(str);
    	return unescaped;
    }
    
    public static String encodeHtml(String str){
    	if(str == null){
    		return "";
    	}
    	String unescaped = HtmlEscape.escapeHtml(str, 
    			HtmlEscapeType.HTML5_NAMED_REFERENCES_DEFAULT_TO_HEXA, 
    			HtmlEscapeLevel.LEVEL_2_ALL_NON_ASCII_PLUS_MARKUP_SIGNIFICANT);
    	return unescaped;
    }
    
    public static String filterHtmlTags(String str){
    	String html = str;
    	// 过滤注释
    	html = html.replaceAll("<!--[\\s\\S]*?-->", "");
    	// 过滤<head>部分，只保留<body>部分
    	html = html.replaceAll("<[h|H][e|E][a|A][d|D]\\b[^>]*>([\\s\\S]*?)<\\/[h|H][e|E][a|A][d|D]>", "");
    	// 过滤<script>部分
    	html = html.replaceAll("<[s|S][c|C][r|R][i|I][p|P][t|T]\\b[^>]*>([\\s\\S]*?)<\\/[s|S][c|C][r|R][i|I][p|P][t|T]>", "");
    	
    	html = html.replaceAll("\\r\\n", "").replaceAll("\\r", "").replaceAll("\\n", "");
    	html = html.replaceAll("(<[h|H][1-9]+[\\s]+[^(>)]*>)|(<[h|H][1-9]+[\\s]*)>", "\r\n");
    	html = html.replaceAll("(<[d|D][i|I][v|V][\\s]+[^(>)]*>)|(<[d|D][i|I][v|V][\\s]*>)", "\r\n");
    	html = html.replaceAll("(<[p|P][\\s]+[^(>)]*>)|(<[p|P][\\s]*>)", "\r\n");
    	html = html.replaceAll("(<[t|T][a|A][b|B][l|L][e|E][\\s]+[^(>)]*>)|(<[t|T][a|A][b|B][l|L][e|E][\\s]*>)", "\r\n");
    	html = html.replaceAll("(<[t|T][r|R][\\s]+[^(>)]*>)|(<[t|T][r|R][\\s]*>)", "\r\n");
    	html = html.replaceAll("(<[t|T][d|D|h|H][\\s]+[^(>)]*>)|(<[t|T][d|D|h|H][\\s]*>)", "\t");
    	html = html.replaceAll("<[b|B][r|R][\\s]*(/)?>", "\r\n");
    	html = html.replaceAll("<[^>]*>", ""); // 过滤所有html tags
    	
    	return html.trim();
    }
    
    public static String getUri(String url){
    	int idx = url.indexOf("?");
    	if(idx < 0){
    		return url;
    	}
    	
    	return url.substring(0, idx);
    }
    
    public static String securitySql(String sqlpart){
    	String sql = sqlpart.toLowerCase().replace("delete", "").replace("update", "").replace("insert", "");
    	sql = sql.replace("call", "");
    	
    	return sql;
    }
    
    public static String splitAndCombine(String str, char[] signs){
    	String[] parts = splitString(str, signs);
    	StringBuilder sb = new StringBuilder();
    	for(String part : parts){
    		String s = securitySql(part);
    		if(s != null && s.length() > 0){
        		sb.append(s).append(",");
    		}
    	}
    	String res = sb.toString();
    	if(res.endsWith(",")){
    		return res.substring(0, res.length()-1);
    	}
    	return res;
    }
    
    public static String splitAndCombine(String str, char sign){
    	return splitAndCombine(str, new char[]{sign});
    }
    
    public static Properties getProperties(byte[] raw){
    	try{
			String txt = new String(raw);
			StringReader reader = new StringReader(txt);
			Properties p = new Properties();
			p.load(reader);    	
			return p;
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}
    }
    
    public static String dollarUnicodeToStr(String unicode) {
        StringBuffer sb = new StringBuffer();
        
        String[] hex = unicode.split("\\$u");
        if(hex.length <= 1) {
            hex = unicode.split("\\$U");
            if(hex.length <= 1) {
            	return unicode;            	
            }
        }
      
        if(hex[0] != null && hex[0].length() > 0) {
            sb.append(hex[0]);        	
        }
        for (int i = 1; i < hex.length; i++) {
        	if(hex[i].length() > 4) {
                int data = Integer.parseInt(hex[i].substring(0, 4), 16);
                sb.append((char) data); 
                sb.append(hex[i].substring(4));
        	}else {
                int data = Integer.parseInt(hex[i], 16);
                sb.append((char) data);        		
        	}
        }
        return sb.toString();  

    }
    
    public static String dollarAsciiUniToStr(String ascii) {
        StringBuffer sb = new StringBuffer();
        
        String[] hex = ascii.split("\\$");
        if(hex.length <= 1) {
        	return ascii;            	
        }
      
        if(hex[0] != null && hex[0].length() > 0) {
            sb.append(hex[0]);        	
        }
        for (int i = 1; i < hex.length; i++) {
        	if(hex[i].length() > 2) {
        		String first = hex[i].substring(0, 1);
        		if(first.toLowerCase().equals("u")) {
        			String uni = hex[i].substring(1, 5);
                    int data = Integer.parseInt(uni, 16);
                    sb.append((char) data); 
                    sb.append(hex[i].substring(5));        			
        		}else {
                    int data = Integer.parseInt(hex[i].substring(0, 2), 16);
                    sb.append((char) data); 
                    sb.append(hex[i].substring(2));        			
        		}
        	}else {
                int data = Integer.parseInt(hex[i], 16);
                sb.append((char) data);        		
        	}
        }
        return sb.toString();  

    }
    
    public static String fillPrefix(String str, char prefix, int count) {
    	StringBuilder sb = new StringBuilder();
    	if(count <= 0) {
    		return str;
    	}
    	
    	for(int i=0; i<count ;i++) {
    		sb.append(prefix);
    	}
    	sb.append(str);
    	return sb.toString();
    }
    
    public static String toUnicodeStr(String str, boolean needprefix) {
		StringBuffer sb = new StringBuffer();
		char[] c = str.toCharArray();
		for (int i = 0; i < c.length; i++) {
			if(needprefix) {
				sb.append("\\u");
			}
			String hexstr = Integer.toHexString(c[i]);
			if(hexstr.length() < 4) {
				int delta = 4 - hexstr.length();
				hexstr = fillPrefix(hexstr, '0', delta);
			}
			sb.append(hexstr);
		}
		return sb.toString();
    }
    
    public static String toUnicodeStrWithoutPrefix(String str) {
    	return toUnicodeStr(str, false);
    }

    public static String toUnicodeStrWithPrefix(String str) {
    	return toUnicodeStr(str, true);
    }
    
    public static String unicodeToString(String unicode) {
		StringBuffer sb = new StringBuffer();
		String[] hex = unicode.split("\\\\u");
		for (int i = 0; i < hex.length; i++) {
			int index = Integer.parseInt(hex[i], 16);
			sb.append((char) index);
		}
		return sb.toString();
	}

    public static String unicodeToStringNoPrefix(String unicode) {
		StringBuffer sb = new StringBuffer();
		char[] chars = unicode.toCharArray();
		for (int i = 0; i < chars.length; i+=4) {
			String hex = String.format("%c%c%c%c", chars[i], chars[i+1], chars[i+2], chars[i+3]);
			int index = Integer.parseInt(hex, 16);
			sb.append((char) index);
		}
		return sb.toString();
	}
    
    public static boolean findByRegexpr(String text, String regexpr) {
		Pattern p = Pattern.compile(regexpr);
		Matcher matcher = p.matcher(text);
		boolean flag = matcher.find();
		return flag;
    }
    
    public static boolean isChineseRule(String text) {
		String pattern = "[0-9_\\+\\-\\*\\/\\^\\%\\(\\)\\@\\#\\~\\.\\:：。\\,，\\!！\\'‘\"“\\?？”\\u4e00-\\u9fa5]+";
		return findByRegexpr(text, pattern);
    }
    
    public static void main(String[] args){
//    	String qrcode = toString("abc", 8, '\0', false);
//    	String code = toHex(244, true);
//    	System.out.println(code);
    	
		String test = "/";
		System.out.println(trimStart(test, "/"));
		
		System.out.println(toFileSize(2066346699));
		
		System.out.println(isEmail("aaa@qq.com"));
		
		String str = "1,2.3,delete * from aasa,";
		str = splitAndCombine(str, ',');
		System.out.println(str);
		
		long[] ary = new long[]{1,2,3,4,5,6};
		test = "这是个测试，2015-09-23 12:00:00";
		char[] sig = ".".toCharArray();
		String[] parts = splitString(test, '-');
		System.out.println(ConvertUtility.getValueAsString(parts));
		
		test = "slot:/gene/$u65b9$u6ce21/12";
		String dec = dollarUnicodeToStr(test);
		System.out.println(dec);
		System.out.println(getUUID());
		
		test = "/ModbusTcpDevice$2dJYA$2eCP503/points/MCC$20A/C$20PHASE$20CURRENT$u65b9$u6ce21";
		test = "/Drivers/ModbusTcpNetwork/ModbusTcpDevice$2dGMC$2eCP200/points/SENSOR/GMC$20PT101B";
		dec = dollarAsciiUniToStr(test);
		System.out.println(dec);
		
		test = "abc";
		System.out.println(toUnicodeStr(test, false));
		
		Set<Integer> set = new HashSet<Integer>();
		for(int i=0; i<10; i++) {
			set.add(i);
		}
		test = joinWithSeperator(",", set);
		System.out.println(test);
    }
    
}
