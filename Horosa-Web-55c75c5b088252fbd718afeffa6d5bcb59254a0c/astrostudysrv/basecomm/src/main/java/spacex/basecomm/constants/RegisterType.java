package spacex.basecomm.constants;

public enum RegisterType {
	CoilStatus(0),			// 01 线圈状态(Coil Status) (0x)		地址范围：00001～09999
	InputStatus(1),			// 02 输入状态 (Input Status) (1x)		地址范围：10001~19999
	HoldingRegister(2),		// 03 保持寄存器(Holding Register) (4x)	地址范围：40001～49999
	InputRegister(3);		// 04 输入寄存器 (Input Register) (3x)	地址范围：30001~39999
	
	private int code;
	private RegisterType(int code){
		this.code = code;
	}
	
	public int getCode(){
		return this.code;
	}
	
	public static RegisterType fromCode(int code){
		for(RegisterType type : RegisterType.values()){
			if(type.getCode() == code){
				return type;
			}
		}
		return CoilStatus;
	}
	
}
