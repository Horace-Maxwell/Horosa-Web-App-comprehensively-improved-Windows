package test.utility;

import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;

import boundless.io.FileUtility;
import boundless.security.RCUtility;
import boundless.security.SecurityUtility;
import boundless.utility.*;


public class StringUtilityTest {
	
	static HashMap<Character, Byte> hex = new HashMap<Character, Byte>();
	static{
		hex.put('0', (byte)0);
		hex.put('1', (byte)1);
		hex.put('2', (byte)2);
		hex.put('3', (byte)3);
		hex.put('4', (byte)4);
		hex.put('5', (byte)5);
		hex.put('6', (byte)6);
		hex.put('7', (byte)7);
		hex.put('8', (byte)8);
		hex.put('9', (byte)9);
		hex.put('a', (byte)10);
		hex.put('b', (byte)11);
		hex.put('c', (byte)12);
		hex.put('d', (byte)13);
		hex.put('e', (byte)14);
		hex.put('f', (byte)15);
		hex.put('A', (byte)10);
		hex.put('B', (byte)11);
		hex.put('C', (byte)12);
		hex.put('D', (byte)13);
		hex.put('E', (byte)14);
		hex.put('F', (byte)15);		
	}
	
	
	static byte getByteC(char c){
		if(c >= 'a' && c <='f'){
			return (byte)(c - 87);
		}
		if(c >= 'A' && c <='F'){
			return (byte)(c - 55);
		}
		if(c >= '0' && c <='9'){
			return (byte)(c - 48);
		}
		return 0;
	}
	
	private static void timetest(Date time1, Date time2){
    	Calendar firstcal = Calendar.getInstance();
    	firstcal.setTime(time1);
    	firstcal.set(firstcal.get(Calendar.YEAR), firstcal.get(Calendar.MONTH), firstcal.get(Calendar.DAY_OF_MONTH), 0, 0, 0);
    	firstcal.set(Calendar.MILLISECOND, 0);
    	final long firstIFrameDayMS = firstcal.getTimeInMillis();
    	
    	Calendar currIFramecal = Calendar.getInstance();
    	currIFramecal.setTime(time2);
    	currIFramecal.set(currIFramecal.get(Calendar.YEAR), currIFramecal.get(Calendar.MONTH), currIFramecal.get(Calendar.DAY_OF_MONTH), 0, 0, 0);
    	currIFramecal.set(Calendar.MILLISECOND, 0);
    	final long currIFrameDayMS = currIFramecal.getTimeInMillis();
	}

	public static void main(String args[]) throws Throwable {
/*		
		System.out.println("trim:"+StringUtility.trim("{}{id:1,name:test{}{}}}", new char[]{'{','}'}));
		String tst = "A compl-icated ( gentleman ) all.ow me to present, 101=101";
		tst = tst.replaceAll("[\\ \\.\\(\\,\\)\\-\\=]", "_");
		System.out.println(tst);
		
				
		
    	Calendar firstcal = Calendar.getInstance();
    	System.out.println(FormatUtility.formatDateTime(firstcal.getTime(), "yyyy-MM-dd HH:mm:ss.SSS"));
    	firstcal.set(firstcal.get(Calendar.YEAR), firstcal.get(Calendar.MONTH), firstcal.get(Calendar.DAY_OF_MONTH), 0, 0, 0);
    	firstcal.set(Calendar.MILLISECOND, 0);
    	long firstms = firstcal.getTimeInMillis();
    	
    	Calendar cal = Calendar.getInstance();
    	cal.add(Calendar.HOUR_OF_DAY, 6);
    	System.out.println(FormatUtility.formatDateTime(cal.getTime(), "yyyy-MM-dd HH:mm:ss.SSS"));
    	cal.set(cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH), 0, 0, 0);
    	cal.set(Calendar.MILLISECOND, 0);
    	long lastms = cal.getTimeInMillis();

    	boolean flag = lastms > firstms;
    	System.out.println(firstms + "\t" + lastms + "\t" + flag);
    	
    	char c = '0';
    	System.out.println(c);
    	
    	byte b = (byte) c;
    	System.out.println(b);
    	
    	int loop = 100000;
    	Date t1 = new Date();
    	for(int i=0; i<loop; i++){
    		c =  (char)((i % 10) + 48);
    		b = getByteC(c);
    	}
    	System.out.println(new Date().getTime() - t1.getTime());
    			
    	Date t2 = new Date();
    	for(int i=0; i<loop; i++){
    		c =  (char)((i % 10) + 48);
    		b = hex.get(c);
    	}
    	System.out.println(new Date().getTime() - t2.getTime());
*/		
//		Date t1 = new Date();
//		Date t2 = new Date();
//		long cnt = 0;
//		for(int s = 0; s<100; s++){
//			Date start = new Date();
//			for(int i=0; i<100000; i++){
//				timetest(t1, t2);
//			}
//			long delta = new Date().getTime() - start.getTime();
//			cnt += delta;
//			System.out.println(delta);
//		}
//		System.out.println("average:" + cnt / 100);

//		byte[] data = {1,2,3,4,5,6};
//		byte[] key = SecurityUtility.generateSecureRandomKey(16);
//		byte[] res = RCUtility.rc4Encrypt(data, key);
//		System.out.println(ConvertUtility.getValueAsString(res));
		
//		String path = FileUtility.combinePath("/aaa/", "bbb", "ccc");
//		System.out.println(path);
		
//		String[] files = FileUtility.searchFiles("d:/file", "a.*");
//		String[] files1 = FileUtility.searchFiles("d:/file", "a");
//		System.out.println(ConvertUtility.getValueAsString(files));
//		System.out.println(ConvertUtility.getValueAsString(files1));
		
		byte[] key = {-97, 38, 21, 54, -61, -54, -33, -21, -44, 15, 124, -47, -86, 1, 88, -92};
		for(int i=0; i<key.length; i++){
			System.out.print(ConvertUtility.getValueAsUInt8(key[i]) + ", ");
		}
		System.out.println();
		
		byte[] rc4res = RCUtility.rc4Encrypt(key, key);
		System.out.println(ConvertUtility.getValueAsString(rc4res));
		
		for(int i=0; i<rc4res.length; i++){
			System.out.print(String.format("0x%02X", rc4res[i]) + ", ");
		}
		System.out.println();
		
		byte[] org = RCUtility.rc4Decrypt(rc4res, key);
		for(int i=0; i<org.length; i++){
			System.out.print(ConvertUtility.getValueAsUInt8(org[i]) + ", ");
		}
		System.out.println();
		
		for(int i=0; i<org.length; i++){
			System.out.print(String.format("0x%02X", org[i]) + ", ");
		}
		System.out.println();
		
		System.out.println(StringUtility.getUUID());
		
		String tstr = "{ok}{ok}";
		String formula = "x={down}";
		String[] fparts = StringUtility.splitString(formula, '=');
		System.out.println(tstr.contains(fparts[1]));
		
	}
}
