package spacex.astrostudycn.constants;

public enum TimeZiAlg {
	RealSun(0),
	DirectTime(1),
	SpringMao(2),
	LocalMao(3);
	
	private int code;
	private TimeZiAlg(int c) {
		this.code = c;
	}
	
	public int getCode() {
		return this.code;
	}
	
	public static TimeZiAlg fromCode(int c) {
		for(TimeZiAlg tz : TimeZiAlg.values()) {
			if(tz.getCode() == c) {
				return tz;
			}
		}
		return RealSun;
	}
	
}
