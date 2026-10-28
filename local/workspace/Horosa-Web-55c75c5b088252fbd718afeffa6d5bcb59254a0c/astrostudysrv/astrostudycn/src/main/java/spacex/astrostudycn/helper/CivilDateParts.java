package spacex.astrostudycn.helper;

/**
 * 日期串 → 年 / 月 / 日(单一来源)。认 'YYYY-MM-DD' / 'YYYY/MM/DD' / '-YYYY-MM-DD' / '-YYYY/MM/DD',可带时刻尾巴,
 * 年份 1–5 位。年份按历史纪年读(公元前为负、没有公元 0 年;公元前 300 年 = -300)。
 *
 * 公元前日期带前导负号:裸 split("-") 会把 "-300-12-10" 拆成 ["", "300", "12", "10"],取第 2 段当月份就读成 300。
 * 日期串取段一律经本类,不在调用处自己拆。
 */
public final class CivilDateParts {

	/** 历史纪年(公元前为负)。 */
	public final int year;
	/** 1–12;串里没有月段时为 null。 */
	public final Integer month;
	/** 1–31;串里没有日段时为 null。 */
	public final Integer day;
	/** 串首带负号(公元前)。 */
	public final boolean negative;

	private CivilDateParts(int year, Integer month, Integer day, boolean negative) {
		this.year = year;
		this.month = month;
		this.day = day;
		this.negative = negative;
	}

	/** 认不出(空串 / 年段不是数 / 年为 0)→ null。月 / 日段不是数时该段为 null。 */
	public static CivilDateParts parse(String date) {
		if(date == null) {
			return null;
		}
		String dt = date.trim();
		int sp = dt.indexOf(' ');
		if(sp >= 0) {
			dt = dt.substring(0, sp);
		}
		int tp = dt.indexOf('T');
		if(tp > 0) {
			dt = dt.substring(0, tp);
		}
		dt = dt.replace('/', '-');
		boolean neg = dt.startsWith("-");
		if(neg) {
			dt = dt.substring(1);
		}
		if(dt.isEmpty()) {
			return null;
		}
		String[] parts = dt.split("-");
		Integer y = intOrNull(parts[0]);
		if(y == null || y.intValue() == 0) {
			return null;
		}
		Integer m = parts.length > 1 ? intOrNull(parts[1]) : null;
		Integer d = parts.length > 2 ? intOrNull(parts[2]) : null;
		return new CivilDateParts(neg ? -Math.abs(y.intValue()) : y.intValue(), m, d, neg);
	}

	/** 历史纪年 → 天文年(公元前 1 年 = 0;公元前 300 年 = -299)。 */
	public static int astronomicalYear(int historicalYear) {
		return historicalYear < 0 ? historicalYear + 1 : historicalYear;
	}

	private static Integer intOrNull(String s) {
		if(s == null) {
			return null;
		}
		String t = s.trim();
		if(t.isEmpty()) {
			return null;
		}
		try {
			return Integer.valueOf(Integer.parseInt(t));
		}catch(NumberFormatException e) {
			return null;
		}
	}
}
