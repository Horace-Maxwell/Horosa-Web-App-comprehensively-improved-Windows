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

	/**
	 * 八字类排盘实际采用的换算口径。「春分定卯时」尚无独立换算:排盘界面该档不可选并注明结果等同「直接时间」,
	 * 帮助文档与本地引擎也按不换算处理 → 一律按「直接时间」算。其余各档原样。
	 */
	public TimeZiAlg calcBasis() {
		return this == SpringMao ? DirectTime : this;
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
