package test.utility;

import boundless.utility.ByteUtility;

public class ByteUtilityTest {

	public static void main(String[] args) {
		byte[] data = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15};
		System.out.println(ByteUtility.toHexString(data, false));
	}

}
