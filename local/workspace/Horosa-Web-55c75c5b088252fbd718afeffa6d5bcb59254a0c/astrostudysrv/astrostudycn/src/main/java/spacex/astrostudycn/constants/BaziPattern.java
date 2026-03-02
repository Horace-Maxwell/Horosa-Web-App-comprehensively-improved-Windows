package spacex.astrostudycn.constants;

public enum BaziPattern {
	Guang(0),
	Sa(1),
	Yin(2),
	Cai(3),
	Si(4),
	San(5),
	Bi(6),
	Ren(7),
	CongWang(8),
	CongRuo(9),
	Other(10),
	Unknown(-1);
	
	private int code;
	private BaziPattern(int code) {
		this.code = code;
	}
	
	public int getCode() {
		return this.code;
	}
	
	public String toString() {
		switch(this) {
		case Guang: return "官格";
		case Sa: return "煞格";
		case Yin: return "印格";
		case Cai: return "财格";
		case Si: return "食神格";
		case San: return "伤官格";
		case Bi: return "比劫格";
		case Ren: return "阳刃格";
		case CongWang: return "从旺";
		case CongRuo: return "从弱";
		case Other: return "杂格";
		default: return "未知";
		}
	}
	
	public static BaziPattern fromCode(int code) {
		for(BaziPattern pattern : BaziPattern.values()) {
			if(pattern.code == code) {
				return pattern;
			}
		}
		return Unknown;
	}
	
}
