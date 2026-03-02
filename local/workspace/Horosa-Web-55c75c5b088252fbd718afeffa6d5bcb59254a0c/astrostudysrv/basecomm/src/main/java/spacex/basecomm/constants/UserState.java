package spacex.basecomm.constants;

public enum UserState {
	NORMAL((byte)0),
	LOCK((byte)1),
	DELETE((byte)2);
	
	private byte code;
	private UserState(byte code){
		this.code = code;
	}
	
	public byte getCode(){
		return this.code;
	}
}
