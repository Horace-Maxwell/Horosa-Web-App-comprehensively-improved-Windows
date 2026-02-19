package boundless.net;

public enum PrimaryDataType {
	BOOLEAN((byte)0),
	ENUM((byte)1),
	DOUBLE((byte)2),
	STRING((byte)3);
	
	private byte code;
	PrimaryDataType(byte code){
		this.code = code;
	}
	
	public byte getCode(){
		return this.code;
	}
	
	public String toString(){
		if(this == BOOLEAN){
			return "ValueBool";
		}
		if(this == ENUM){
			return "ValueEnum";
		}
		if(this == DOUBLE){
			return "ValueDouble";
		}
		if(this == STRING){
			return "ValueStr";
		}
		return null;
	}
}
