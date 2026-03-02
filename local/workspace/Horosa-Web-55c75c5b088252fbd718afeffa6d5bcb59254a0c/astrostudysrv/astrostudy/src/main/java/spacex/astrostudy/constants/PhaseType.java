package spacex.astrostudy.constants;

public enum PhaseType {
	HuoTu(0),
	ShuiTu(1),
	YingYang(2);
	
	private int code;
	private PhaseType(int code) {
		this.code = code;
	}
	
	public int getCode() {
		return this.code;
	}
	
	public static PhaseType fromCode(int code) {
		for(PhaseType t : PhaseType.values()) {
			if(code == t.getCode()) {
				return t;
			}
		}
		return HuoTu;
	}
}
