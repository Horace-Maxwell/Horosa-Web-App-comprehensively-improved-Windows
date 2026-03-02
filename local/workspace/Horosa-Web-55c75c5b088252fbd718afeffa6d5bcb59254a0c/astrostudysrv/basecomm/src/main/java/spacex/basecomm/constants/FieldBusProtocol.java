package spacex.basecomm.constants;

public enum FieldBusProtocol {
	Bacnet(0),
	Modbus(1),
	OPCDA(2),
	OPCUA(3),
	OBIX(4),
	BEM(5),
	MQTT(6);
	
	private int code;
	private FieldBusProtocol(int code) {
		this.code = code;
	}
	
	public int getCode() {
		return this.code;
	}
	
	public static FieldBusProtocol fromCode(int code){
		for(FieldBusProtocol prot : FieldBusProtocol.values()){
			if(code == prot.getCode()){
				return prot;
			}
		}
		return null;
	}
	
}
