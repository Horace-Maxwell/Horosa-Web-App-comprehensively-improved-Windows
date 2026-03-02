package boundless.utility;

import java.lang.reflect.Array;
import java.nio.ByteBuffer;
import java.util.HashMap;
import java.util.Map;

import boundless.net.ByteOrder;

public class ByteUtility {
	public static int BYTES_IN_FLOAT = 4;
	
	private static Map<Character, Byte> hexCode = new HashMap<Character, Byte>();
	private static Map<String, Byte> hexStrCode = new HashMap<String, Byte>();
	
	static{
		hexCode.put('0', (byte)0);
		hexCode.put('1', (byte)1);
		hexCode.put('2', (byte)2);
		hexCode.put('3', (byte)3);
		hexCode.put('4', (byte)4);
		hexCode.put('5', (byte)5);
		hexCode.put('6', (byte)6);
		hexCode.put('7', (byte)7);
		hexCode.put('8', (byte)8);
		hexCode.put('9', (byte)9);
		hexCode.put('a', (byte)10);
		hexCode.put('b', (byte)11);
		hexCode.put('c', (byte)12);
		hexCode.put('d', (byte)13);
		hexCode.put('e', (byte)14);
		hexCode.put('f', (byte)15);
		hexCode.put('A', (byte)10);
		hexCode.put('B', (byte)11);
		hexCode.put('C', (byte)12);
		hexCode.put('D', (byte)13);
		hexCode.put('E', (byte)14);
		hexCode.put('F', (byte)15);
		
		hexStrCode.put("0", (byte)0);
		hexStrCode.put("1", (byte)1);
		hexStrCode.put("2", (byte)2);
		hexStrCode.put("3", (byte)3);
		hexStrCode.put("4", (byte)4);
		hexStrCode.put("5", (byte)5);
		hexStrCode.put("6", (byte)6);
		hexStrCode.put("7", (byte)7);
		hexStrCode.put("8", (byte)8);
		hexStrCode.put("9", (byte)9);
		hexStrCode.put("a", (byte)10);
		hexStrCode.put("b", (byte)11);
		hexStrCode.put("c", (byte)12);
		hexStrCode.put("d", (byte)13);
		hexStrCode.put("e", (byte)14);
		hexStrCode.put("f", (byte)15);
		hexStrCode.put("A", (byte)10);
		hexStrCode.put("B", (byte)11);
		hexStrCode.put("C", (byte)12);
		hexStrCode.put("D", (byte)13);
		hexStrCode.put("E", (byte)14);
		hexStrCode.put("F", (byte)15);
	}

	/**
	 * 将字节数组转换成整数值
	 * @param bytes 待转换的字节数组
	 * @param highBitFirst 是否高位在前
	 * @return
	 */
	public static int bytesToInt(byte[] bytes, ByteOrder order) {
		int result = 0;

		if (order == ByteOrder.BIG_ENDIAN) { // 高位在前
			for (int i = 0; i < bytes.length; i++) {
				result <<= 8;
				result |= (bytes[i] & 0xff);
			}
		} else { // 高位在后
			for (int i = bytes.length - 1; i >= 0; i--) {
				result <<= 8;
				result |= (bytes[i] & 0xff);
			}
		}
		return result;
	}

	/**
	 * 将整数转换成字节数组
	 * @param n 要转换的整数
	 * @param length 转换后字节数组长度
	 * @param highBitFirst 是否高位在前
	 * @return
	 */
	public static byte[] intToBytes(long n, int length, ByteOrder order) {
		byte[] result = new byte[length];

		if (order == ByteOrder.BIG_ENDIAN) { // 高位在前
			for (int i = length - 1; i >= 0; i--) {
				result[i] = (byte) n;
				n >>= 8;
			}
		} else { // 高位在后
			for (int i = 0; i < length; i++) {
				result[i] = (byte) n;
				n >>= 8;
			}
		}
		return result;
	}
	
	public static byte[] intToBinBytes(long n, int length, ByteOrder order) {
		byte[] result = new byte[length];
		long num = n;

		if (order == ByteOrder.BIG_ENDIAN) { // 高位在前
			for (int i = length - 1; i >= 0; i--) {
				result[i] = (byte) (num & 1);
				num >>= 1;
			}
		} else { // 高位在后
			for (int i = 0; i < length; i++) {
				result[i] = (byte) (num & 1);
				num >>= 1;
			}
		}
		return result;
	}
	
	public static String intToBinString(long n, int length, ByteOrder order) {
		byte[] result = intToBinBytes(n, length, order);
		StringBuilder sb = new StringBuilder();
		for(byte b : result) {
			sb.append(b);
		}
		return sb.toString();
	}

	
	public static byte getByte(char c){
		Byte b = hexCode.get(c);
		if(b == null){
			System.out.println(c);
		}
		return b.byteValue();
	}
	
	public static Byte getByte(String c){
		return hexStrCode.get(c);
	}
	
	public static long toLong(String str){
		long n = 0l;
		for(int i=0; i<str.length(); i++){
			String cstr = str.substring(i, i+1);
			Byte b = getByte(cstr);
			if(b == null){
				continue;
			}
			n = (n << 4) | b.byteValue();
		}
		return n;
	}

	public static int toInt(String str){
		int n = 0;
		for(int i=0; i<str.length(); i++){
			char c = str.charAt(i);
			n = (n << 4) | getByte(c);
		}
		return n;
	}

	public static short toShort(String str){
		int n = 0;
		for(int i=0; i<str.length(); i++){
			char c = str.charAt(i);
			n = (n << 4) | getByte(c);
		}
		return (short)n;
	}

	public static byte toByte(String str){
		int n = 0;
		for(int i=0; i<str.length(); i++){
			char c = str.charAt(i);
			n = (n << 4) | getByte(c);
		}
		return (byte)n;
	}

	public static long toBCDLong(String str){
		long n = 0l;
		for(int i=0; i<str.length(); i++){
			char c = str.charAt(i);
			n = (n * 10) + getByte(c);
		}
		return n;
	}

	public static int toBCDInt(String str){
		int n = 0;
		for(int i=0; i<str.length(); i++){
			char c = str.charAt(i);
			n = (n * 10) + getByte(c);
		}
		return n;
	}

	public static short toBCDShort(String str){
		int n = 0;
		for(int i=0; i<str.length(); i++){
			char c = str.charAt(i);
			n = (n * 10) + getByte(c);
		}
		return (short)n;
	}

	public static byte toBCDByte(String str){
		int n = 0;
		for(int i=0; i<str.length(); i++){
			char c = str.charAt(i);
			n = (n * 16) + getByte(c);
		}
		return (byte)n;
	}

	/**
	 * 把字节连接成字符串
	 * @param bytes
	 * @param splitChar 分隔符
	 * @return
	 */
	public static String joinAsString(byte[] bytes,char splitChar)
	{
        String result = "";
        for (byte item : bytes)
        {
            result += item + "" + splitChar;    
        }
        return result;
	}
	
	public static String toHexString(byte[] bytes){
		return toHexString(bytes, false);
	}

	/**
	 * 把字节转成16进制字符串
	 * @param bytes
	 * @param prefix 是否带"0x"前缀
	 * @return
	 */
	public static String toHexString(byte[] bytes,boolean prefix){
		return toHexString(bytes,0,bytes.length,prefix);
	}
	
	/**
	 * 把字节转成16进制字符串
	 * @param bytes
	 * @param startIndex bytes的起始位置
	 * @param length 长度
	 * @param prefix 是否带"0x"前缀
	 * @return
	 */
	public static String toHexString(byte[] bytes,int startIndex,int length,boolean prefix){
		StringBuilder ret = new StringBuilder();
		if (prefix) ret.append("0x");
		for (int i = startIndex; i < bytes.length && (i-startIndex)<length; i++) {			
			String hex = String.format("%02X", bytes[i] & 0xFF);
			ret.append(hex);
		}
		return ret.toString();
	}
	
	public static String toHexString(byte[] bytes,int startIndex,int length){
		return toHexString(bytes, startIndex, length, false);
	}
	
	public static String fromBCD(byte n){
		return String.format("%02X", n);
	}
	
	public static String fromBCD(byte[] data){
		StringBuilder sb = new StringBuilder();
		for(byte b : data){
			sb.append(String.format("%02X", b));
		}
		return sb.toString();
	}
	
	public static byte[] toBCD(String str){
		try{
			byte[] data = new byte[str.length() / 2];
			
			for(int i=0, j=0; i<str.length(); i+=2, j++){
				char c1 = str.charAt(i);
				char c2 = str.charAt(i+1);
				byte b1 = hexCode.get(c1);
				byte b2 = hexCode.get(c2);
				data[j] = (byte) ((b1 << 4) | b2);
			}
			return data;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static String fromASCII(byte[] data){
	    StringBuilder sb = new StringBuilder("");
	    for (int i = 0; i < data.length; ++ i) {
	        if (data[i] < 0){
	        	throw new IllegalArgumentException();
	        }else if(data[i] == 0){
	        	break;
	        }
	        sb.append((char) data[i]);
	    }
	    return sb.toString();

	}
	
	public static byte[] toASCIIWithoutNull(String str){
		byte[] data = new byte[str.length()];
		for(int i=0; i<str.length(); i++){
			data[i] = (byte) str.charAt(i);
		}
		return data;
	}
	
	public static byte[] toASCII(String str){
		byte[] data = new byte[str.length() + 1];
		for(int i=0; i<str.length(); i++){
			data[i] = (byte) str.charAt(i);
		}
		data[str.length()] = 0;
		return data;
	}
	
	public static byte[] toASCII(String str, int len){
		byte[] data = new byte[len];
		int j = 0;
		if(StringUtility.isNullOrEmpty(str)){
			data[0] = 0;
		}else{
			for(int i=0; i<str.length() && i<len-1; i++, j++){
				data[i] = (byte) str.charAt(i);
			}
		}
		data[j] = 0;
		return data;
	}
	
	
	public static byte[] toHexData(String hexstr){
		String[] data = hexstr.split(" ");
		byte[] res = new byte[data.length];
		for(int i=0; i<data.length; i++){
			String str = data[i];
			res[i] = toBCDByte(str);
		}
		return res;
	}
	
	public static byte[] toBytes(byte fill, int length){
		byte[] res = new byte[length];
		Array.setByte(res, 0, fill);
		return res;
	}
	
	public static byte calculateChecksum(byte[] data){
		byte value = 0;
		for(byte n : data){
			value += n;
		}
		return (byte)value;
	}
	
	public static byte[] toBytes(String str, String enc, int length){
		try{
			byte[] raw = str.getBytes(enc);
			byte[] res = new byte[length];
			if(length < raw.length){
				throw new Exception("length to short");
			}
			System.arraycopy(raw, 0, res, 0, raw.length);
			return res;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static String fromBytes(byte[] data, String enc){
		try{
			return new String(data, enc);
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static float toFloat(int n){
		return Float.intBitsToFloat(n);
	}
	
	public static double toDouble(long n){
		return Double.longBitsToDouble(n);
	}
	
	/**
	 * 判断小数部分是否为0
	 * @param n
	 * @return
	 */
	public static boolean isDecZero(double n) {
		return n % 1 == 0;
	}

	public static byte[] toByteArray(float[] floatArray) {
	    ByteBuffer buffer = ByteBuffer.allocate(floatArray.length * BYTES_IN_FLOAT);
	    buffer.asFloatBuffer().put(floatArray);
	    return buffer.array();
	}


	public static float[] toFloatArray(byte[] byteArray) {
	    float[] result = new float[byteArray.length / BYTES_IN_FLOAT];
	    ByteBuffer.wrap(byteArray).asFloatBuffer().get(result, 0, result.length);
	    return result;
	}	
	public static void main(String[] args){
		String str = "01026F6C3A";
		byte[] res = toBytes("中文", "UTF-8", 64);
		str = fromBytes(res, "UTF-8");
		System.out.println(ConvertUtility.getValueAsString(res));
		System.out.println(str);
		System.out.println(isDecZero(0.0000000000001));
		
		String s = intToBinString(60, 6, ByteOrder.LITTLE_ENDIAN);
		System.out.println(s);
		
		res = intToBytes(63, 4, ByteOrder.BIG_ENDIAN);
		System.out.println(ConvertUtility.getValueAsString(res));
	}
}
