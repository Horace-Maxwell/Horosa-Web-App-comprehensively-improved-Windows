package test.net;

import boundless.net.ByteOrder;
import boundless.net.StreamWriter;
import boundless.utility.ByteUtility;

public class TestStreamWriter {

	public static void main(String[] args) {
		StreamWriter sw = new StreamWriter();
		sw.order(ByteOrder.BIG_ENDIAN);
		
		long n = 1289l;
		sw.write(n);
		byte[] raw = sw.toArray();
		
		String hex = ByteUtility.toHexString(raw);
		
		System.out.println(hex);
	}

}
