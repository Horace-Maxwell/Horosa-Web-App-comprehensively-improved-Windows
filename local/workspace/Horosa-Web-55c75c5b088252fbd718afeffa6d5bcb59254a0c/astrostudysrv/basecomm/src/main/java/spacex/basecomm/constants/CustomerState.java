package spacex.basecomm.constants;

public enum CustomerState {
	NORMAL((byte)0),
	DELETE((byte)1);
	
	private byte code;
	private CustomerState(byte code){
		this.code = code;
	}
	
	public byte getCode(){
		return this.code;
	}
}
