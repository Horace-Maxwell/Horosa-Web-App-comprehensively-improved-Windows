package spacex.astrostudy.constants;

public enum MemoType {
	Astro(0, "Astro"), 
	BaZi(1, "BaZi"),
	ZiWei(2, "ZiWei"),
	M74(3, "74"),
	Gua(4, "Gua"),
	LiuReng(5, "LiuReng"),
	QiMeng(6, "QiMeng"),
	SuZhan(7, "SuZhan");
	
	private int code;
	private String txt;
	private MemoType(int code, String txt) {
		this.code = code;
		this.txt = txt;
	}
	
	public int getCode() {
		return this.code;
	}
	
	public String toString() {
		return String.format("memo%s", this.txt);
	}
	
	public static MemoType fromCode(int code) {
		for(MemoType t : MemoType.values()) {
			if(t.getCode() == code) {
				return t;
			}
		}
		return Astro;
	}

}
