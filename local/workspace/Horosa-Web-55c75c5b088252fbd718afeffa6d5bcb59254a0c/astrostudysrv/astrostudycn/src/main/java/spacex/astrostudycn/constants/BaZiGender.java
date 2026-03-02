package spacex.astrostudycn.constants;

public enum BaZiGender {
	Female(0), Male(1);
	
	private int code;
	private BaZiGender(int code) {
		this.code = code;
	}
	
	public int getCode() {
		return this.code;
	}
	
	@Override
	public String toString() {
		return this == Female ? "坤造" : "乾造";
	}
	
	public String toSimpleString() {
		return this == Female ? "女" : "男";
	}
	
	static public BaZiGender fromValue(boolean gender) {
		if(gender) {
			return Male;
		}
		return Female;
	}
	
	static public BaZiGender fromCode(int code) {
		if(code == 0) {
			return Female;
		}
		return Male;
	}
}
