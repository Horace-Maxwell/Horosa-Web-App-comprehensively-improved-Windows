package boundless.utility;


public class CRCUtility {

	public static short updateCRC16(byte[] data){
		short res = (short) 0xffff;
		for(int i=0; i<data.length; i++){
			res = update(res, data[i]);
		}
		
		return res;
	}
	
	private static short update(short value, byte data){
		short res = value;
		byte hi = (byte) (value >> 8);
		byte low = (byte) (value & 0xff);
		byte tmp = (byte) (low ^ data);
		res = (short) ((hi << 8) | tmp);
		for(int i=0; i<8; i++){
			res = (short)(res >> 1);
			byte c = (byte) (res & 1);
			if(c == 1){
				res = (short)(res ^ 0xA001);
			}
		}
		
		return res;
	}
	
}
