package spacex.basecomm.constants;

public enum SexType {
	FEMALE((byte)0),
	MALE((byte)1);
	
	private byte code;
	private SexType(byte code){
		this.code = code;
	}
	
	public byte getCode(){
		return this.code;
	}
}
