package spacex.astrostudycn.constants;

public enum ZiWeiStarType {
	StarMain(0),
	StarAssist(1),
	StarEvil(2),
	StarOtherGood(3),
	StarOtherBad(4),
	StarSmall(5);
	
	private int code;
	private ZiWeiStarType(int code) {
		this.code = code;
	}
	
	public int getCode() {
		return this.code;
	}
	
}	
