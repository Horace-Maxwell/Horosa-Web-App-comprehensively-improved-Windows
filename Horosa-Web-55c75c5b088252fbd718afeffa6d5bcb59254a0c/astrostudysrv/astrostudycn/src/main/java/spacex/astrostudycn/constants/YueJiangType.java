package spacex.astrostudycn.constants;

public enum YueJiangType {
	Qi(0),
	Jie(1);
	
	private int code;
	private YueJiangType(int c) {
		this.code = c;
	}
	
	public int getCode() {
		return this.code;
	}
	
	public static YueJiangType fromCode(int c) {
		for(YueJiangType t : YueJiangType.values()) {
			if(c == t.getCode()) {
				return t;
			}
		}
		return Qi;
	}
	
}
