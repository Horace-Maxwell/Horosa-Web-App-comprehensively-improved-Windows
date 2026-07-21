package spacex.astrostudycn.model;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import boundless.spring.help.PropertyPlaceholder;
import boundless.utility.ConvertUtility;
import boundless.utility.DateTimeUtility;
import boundless.utility.JsonUtility;
import boundless.utility.PositionUtility;
import spacex.astrostudy.constants.PhaseType;
import spacex.astrostudy.constants.StemBranch;
import spacex.astrostudy.helper.AstroHelper;
import spacex.astrostudy.helper.BaZiHelper;
import spacex.astrostudy.helper.GodsHelper;
import spacex.astrostudy.helper.JdnHelper;
import spacex.astrostudy.helper.NongliHelper;
import spacex.astrostudy.helper.TiaoHouHelper;
import spacex.astrostudy.model.FourColumns;
import spacex.astrostudy.model.GanZi;
import spacex.astrostudy.model.NongLi;
import spacex.astrostudy.model.RealSunTimeOffset;
import spacex.astrostudy.model.godrule.GodRule;
import spacex.astrostudycn.constants.BaZiGender;
import spacex.astrostudycn.constants.TimeZiAlg;
import spacex.astrostudycn.helper.BaZiPredictHelper;
import spacex.astrostudycn.helper.GuaHelper;
import spacex.astrostudycn.helper.GuaHelper.HuGua;
import spacex.astrostudycn.helper.SeasonHelper;

public class BaZi {
	private static final String GUOLAO_LIFE_MODE_ASC = "asc";
	private static final String GUOLAO_LIFE_MODE_YUMAO = "yumao";       // 日出安命(实际日出 riseHour)
	private static final String GUOLAO_LIFE_MODE_COTRANS = "cotrans";
	private static final String GUOLAO_LIFE_MODE_GUMAO = "gumao";       // 古法遇卯安命(时加太阳顺数至卯=日出固定卯时6:00)
	private static final String GUOLAO_LIFE_MODE_CUSTOM = "custom";     // 自定命宫(手动子~亥)

	private static double normalizeLon(double lon) {
		double v = lon % 360.0;
		if(v < 0) {
			v += 360.0;
		}
		if(v >= 360.0) {
			v -= 360.0;
		}
		return v;
	}
	public static int SpringMaoTimeAdjust = PropertyPlaceholder.getPropertyAsInt("spring.maotime.adjust", 180) * 1000;
	
	transient private boolean prevDay = false;
	transient private boolean prevYear = false;
	transient private boolean nextDay = false;
	transient private boolean nextYear = false;
	transient private boolean after23NewDay = false;
	// v3 第二开关·晚子时·时柱起干 (与 after23NewDay 完全独立):
	// true (默认) = 时干用次日日干起子时 (晚子时按次日日柱计算)
	// false        = 时干用今日日干起子时 (晚子时按当日柱计算)
	transient private boolean lateZiHourUseNextDay = true;

	transient protected Map<String, Object>[] jieqiInfo;
	transient protected String oldBirth;
	transient protected String birth;
	transient protected double oldBirthJdn;
	transient protected double birthJdn;
	transient protected int[] birthParts;
	transient protected int[] oldBirthParts;
	transient protected boolean birthAfter23;
	transient protected boolean oldBirthAfter23;
	
	transient protected String zone;
	transient protected String lon;
	transient protected String lat;
	transient protected TimeZiAlg timeAlg;
	transient protected String minggongMethod = "shufa"; // 命宫起法:shufa(数法表·默认)/xingming(星命式),只影响命宫/身宫
	transient protected boolean useZodicalLon;
	transient protected double nextJieJdn;
	transient protected double prevJieJdn;
	transient protected long nextJieSeconds;
	transient protected long prevJieSeconds;
	transient protected String godKeyPos;
	
	transient protected Map<String, Object> sunInfo;
	transient protected Map<String, Object> moonInfo;
	
	protected int timeOffset;
	protected double timeOffsetJDN;
	protected int nongliMonth;
	protected int timezi;
	protected int ad;
	protected boolean adjustJieqi = false;
	
	protected Map<String, Object> nongli;
	protected Map<String, Object> season;	// 旺衰
	
	protected FourColumns fourColumns;
	protected List<String> tiaohou;
	protected Map<String, Object> gong12God = new HashMap<String, Object>();  // 四柱干支对应12串宫神煞
	
	public BaZi(int ad, String birth, String zone, String lon, String lat, TimeZiAlg timeAlg, boolean useZodicalLon, String godKeyPos, boolean after23NewDay) {
		this(ad, birth, zone, lon, lat, timeAlg, useZodicalLon, godKeyPos, after23NewDay, false);
	}

	public BaZi(int ad, String birth, String zone, String lon, String lat, TimeZiAlg timeAlg, boolean useZodicalLon, String godKeyPos, boolean after23NewDay, boolean adjustJieqi) {
		this(ad, birth, zone, lon, lat, timeAlg, useZodicalLon, godKeyPos, after23NewDay, adjustJieqi, true);
	}

	public BaZi(int ad, String birth, String zone, String lon, String lat, TimeZiAlg timeAlg, boolean useZodicalLon, String godKeyPos, boolean after23NewDay, boolean adjustJieqi, boolean lateZiHourUseNextDay) {
		this.timeAlg = timeAlg;
		this.useZodicalLon = useZodicalLon;
		this.birth = birth.replace('/', '-');
		this.zone = zone;
		this.lon = lon;
		this.lat = lat;
		this.oldBirth = this.birth;
		this.fourColumns = new FourColumns();
		this.godKeyPos = godKeyPos;
		this.after23NewDay = after23NewDay;
		this.lateZiHourUseNextDay = lateZiHourUseNextDay;
		this.adjustJieqi = adjustJieqi;
		this.ad = ad;
		if(birth.startsWith("-")) {
			this.ad = -1;
		}


		NongLi nl = NongliHelper.getNongLi(this.ad, this.birth, zone, lon, after23NewDay, false, lateZiHourUseNextDay);
		this.nongli = nl.toMap();

		this.setup();
	}
	
	private int getBaseLonByZone() {
		String sym = this.zone.substring(0, 1);
		String hour = this.zone.substring(1, 3);
		if(hour.startsWith("0")) {
			hour = hour.substring(1, 2);
		}
		int h = ConvertUtility.getValueAsInt(hour);
		int lon = h * 15;
		if(sym.equals("+")) {
			return lon;
		}
		return -lon;
	}
	
	private void adjustJieqiInfo(List<Map<String, Object>> jieqilist) {
		if(!this.adjustJieqi) {
			return;
		}
		
		double latdeg = PositionUtility.convertLatStrToDegree(this.lat);
		if((latdeg < 23.5 && latdeg > -23.5) || (latdeg > 66.5 || latdeg < -66.5)) {
			return;
		}
		
		double delta = (latdeg - 35) * 2;
		if(latdeg < 0) {
			delta = (latdeg + 35) * 2;
		}
		for(Map<String, Object> jieqi : jieqilist) {
			double jdn = ConvertUtility.getValueAsDouble(jieqi.get("jdn")) + delta;
			String time = JdnHelper.getDateFromJdn(jdn, this.zone);
			if(time.startsWith("-")) {
				jieqi.put("ad", -1);
			}
			jieqi.put("time", time);
			jieqi.put("jdn", jdn);
		}
	}
	
	private void setup() {
		int useLocalMao = this.timeAlg == TimeZiAlg.LocalMao ? 1 : 0;
		int byLon = this.useZodicalLon ? 1 : 0;
		Map<String, Object> jieqiinfo = BaZiHelper.getJieQiInfo(this.ad, this.birth, this.zone, this.lon, this.lat, useLocalMao, byLon);
		List<Map<String, Object>> jieqi = (List<Map<String, Object>>) jieqiinfo.get("jieqi");
		this.adjustJieqiInfo(jieqi);

		this.sunInfo = (Map<String, Object>) jieqiinfo.get("Sun");
		this.moonInfo = (Map<String, Object>) jieqiinfo.get("Moon");
		this.jieqiInfo = new Map[jieqi.size()];
		int i = 0;
		for(Map<String, Object> map : jieqi) {
			this.jieqiInfo[i++] = map;
		}
		this.timeOffsetJDN = (double) jieqiinfo.get("timeOffsetJDN");
		this.timeOffset = (int) jieqiinfo.get("timeOffset");
		
		this.oldBirthJdn = DateTimeUtility.getDateNum(this.oldBirth, this.zone);
		this.oldBirthParts = DateTimeUtility.getDateTimeParts(this.oldBirth);
		this.oldBirthAfter23 = DateTimeUtility.isAfter23Hour(this.oldBirth);

		// Always expose both the clock/direct input time and the true solar time,
		// regardless of the selected timeAlg, so the UI can show both without
		// changing the calculation basis (which still follows timeAlg below).
		int realSunOffsetSeconds = RealSunTimeOffset.getOffset(
			String.format("%02d-%02d", this.oldBirthParts[1], this.oldBirthParts[2]),
			this.lon,
			this.getBaseLonByZone()
		);
		String realSunBirth = JdnHelper.getDateFromJdn(
			this.oldBirthJdn + realSunOffsetSeconds / 3600.0 / 24.0,
			this.zone
		);
		this.nongli.put("clockTime", this.oldBirth);
		this.nongli.put("solarTime", realSunBirth);

		if(this.timeAlg == TimeZiAlg.RealSun) {
			String monthday = String.format("%02d-%02d", this.oldBirthParts[1], this.oldBirthParts[2]);
			int baseLon = this.getBaseLonByZone();
			this.timeOffset = RealSunTimeOffset.getOffset(monthday, this.lon, baseLon);
			this.timeOffsetJDN = this.timeOffset / 3600.0 / 24.0;
		}
		
		this.birthJdn = DateTimeUtility.getDateNum(this.birth, this.zone) + this.timeOffsetJDN;
		this.birth = JdnHelper.getDateFromJdn(this.birthJdn, this.zone);
		this.birthParts = DateTimeUtility.getDateTimeParts(this.birth);
		this.birthAfter23 = DateTimeUtility.isAfter23Hour(this.birth);
		
		if(this.jieqiInfo.length < 5) {
			throw new IllegalStateException("jieqi window too short: " + this.jieqiInfo.length + " for " + this.birth);
		}
		Map<String, Object> birthmonth = this.jieqiInfo[2];
		int jieidx = 0;
		for(int idx=0; idx<this.jieqiInfo.length; idx++) {
			Map<String, Object> map = this.jieqiInfo[idx];
			double jdn = (double) map.get("jdn");
			if(jdn <= this.birthJdn) {
				birthmonth = map;
				jieidx = idx;
			}else {
				break;
			}
		}
		boolean isjie = (boolean) birthmonth.get("jie");
		if(!isjie) {
			jieidx -= 1;
			if(jieidx < 0) {
				// 节气窗未包住生辰(上游窗口错位):明确报错进 err 链,绝不负索引裸崩/静默错算
				throw new IllegalStateException("jieqi window misaligned before birth: " + this.birth);
			}
			birthmonth = this.jieqiInfo[jieidx];
		}
		int ord = (int) birthmonth.get("ord");
		double jiejdn = (double)birthmonth.get("jdn");
		this.nongliMonth = ord / 2 + 1;
		int prevjieidx = jieidx - 2;
		int nextjieidx = jieidx + 2;
		if(prevjieidx < 0 || nextjieidx > this.jieqiInfo.length - 1) {
			throw new IllegalStateException(String.format(
				"jieqi window too narrow around birth: %s (idx=%d, window=%d, birthJdn=%.5f, j0=%.5f, j1=%.5f, j2=%.5f)",
				this.birth, jieidx, this.jieqiInfo.length, this.birthJdn,
				(double)(Double)this.jieqiInfo[0].get("jdn"),
				(double)(Double)this.jieqiInfo[1].get("jdn"),
				(double)(Double)this.jieqiInfo[2].get("jdn")));
		}
		if(this.birthJdn < jiejdn) {
			Map<String, Object> prevjie = this.jieqiInfo[prevjieidx];
			double prevjiejdn = (double)prevjie.get("jdn");
			this.prevJieJdn = this.birthJdn - prevjiejdn;
			this.nextJieJdn = jiejdn - this.birthJdn;
		}else {
			Map<String, Object> nextjie = this.jieqiInfo[nextjieidx];
			double nextjiejdn = (double)nextjie.get("jdn");
			this.prevJieJdn = this.birthJdn - jiejdn;
			this.nextJieJdn = nextjiejdn - this.birthJdn;
		}
		
		int tm = this.birthParts[3];
		int oldtm = this.oldBirthParts[3];
		int ziidx = BaZiHelper.getTimeZiIndex(tm);
		int oldziidx = BaZiHelper.getTimeZiIndex(oldtm);
		if(this.timeAlg != TimeZiAlg.DirectTime) {
			this.timezi = ziidx;
		}else {
			this.timezi = oldziidx;
			if(this.oldBirthJdn < jiejdn) {
				Map<String, Object> prevjie = this.jieqiInfo[prevjieidx];
				double prevjiejdn = (double)prevjie.get("jdn");
				this.prevJieJdn = this.oldBirthJdn - prevjiejdn;
				this.nextJieJdn = jiejdn - this.oldBirthJdn;
			}else {
				Map<String, Object> nextjie = this.jieqiInfo[nextjieidx];
				double nextjiejdn = (double)nextjie.get("jdn");
				this.nextJieJdn = nextjiejdn - this.oldBirthJdn;
				this.prevJieJdn = this.oldBirthJdn - jiejdn;
			}
		}
		this.nextJieSeconds = DateTimeUtility.getTotalSecondsFromJdnTime(this.nextJieJdn);
		this.prevJieSeconds = DateTimeUtility.getTotalSecondsFromJdnTime(this.prevJieJdn);
		
		
		int offsetTimeZi = Math.abs(this.timeOffset) / 7200;
		
		if(this.birthJdn < this.oldBirthJdn) {
			if((oldziidx == 0 && ziidx > 0 && oldtm != 23) || offsetTimeZi > oldziidx) {
				this.prevDay = true;
			}
			if(this.oldBirthJdn >= jiejdn && this.birthJdn < jiejdn && this.timeAlg != TimeZiAlg.DirectTime) {
				if(this.nongliMonth == 12) {
					this.prevYear = true;
				}
			}
		}else {
			if((oldziidx > 0 && ziidx == 0) || oldziidx + offsetTimeZi >= 12) {
				this.nextDay = true;
			}
			if(this.oldBirthJdn < jiejdn && this.birthJdn >= jiejdn && this.timeAlg != TimeZiAlg.DirectTime) {
				if(this.nongliMonth == 1) {
					this.nextYear = true;
				}
			}
		}
		
	}
	
	public void setMinggongMethod(String m) {
		if (m != null && !m.isEmpty()) {
			this.minggongMethod = m;
		}
	}

	public void calculate(PhaseType phaseType) {
		this.calculateFourColumn(phaseType);
		this.setupGua();
		
		GodsHelper.findGods(this.fourColumns, this.godKeyPos);
		
		BaZiPredictHelper.save(this, BaZiGender.Male);
		BaZiPredictHelper.save(this, BaZiGender.Female);
	}
	
	
	public void calculateFourColumn(PhaseType phaseType) {
		this.fourColumns.year = BaZiHelper.getYearColumn(this.ad, this.birth, this.zone, this.jieqiInfo, phaseType);
		if(this.nextYear) {
			String ganzi = this.fourColumns.year.ganzi;
			int idx = StemBranch.JiaZiIndex.get(ganzi);
			idx = (idx + 1) % 60;
			ganzi = StemBranch.JiaZi[idx];
			String gan = ganzi.substring(0, 1);
			String zi = ganzi.substring(1);
			GanZi dayCol = new GanZi(gan, zi, phaseType);
			this.fourColumns.year = dayCol;						
		}
		GanZi monthcol = BaZiHelper.getMonthColumn(this.fourColumns.year, this.nongliMonth, phaseType);
		if(lat.toLowerCase().contains("s")) {
			this.fourColumns.month = BaZiHelper.getSouthEarthMonthColumn(this.fourColumns.year, monthcol, phaseType);
		}else {
			this.fourColumns.month = monthcol;
		}
		if(this.timeAlg != TimeZiAlg.DirectTime) {
			boolean afterHour23 = false;
			if(this.timezi == 0 && this.birthAfter23) {
				afterHour23 = true;
			}
			this.fourColumns.day = BaZiHelper.getDayColumn(this.ad, this.birth, this.zone, afterHour23, phaseType, this.after23NewDay);
			if(this.prevDay) {
				String ganzi = this.fourColumns.day.ganzi;
				int idx = StemBranch.JiaZiIndex.get(ganzi);
				idx = (idx + 59) % 60;
				ganzi = StemBranch.JiaZi[idx];
				String gan = ganzi.substring(0, 1);
				String zi = ganzi.substring(1);
				GanZi dayCol = new GanZi(gan, zi, phaseType);
				this.fourColumns.day = dayCol;
			}
			this.fourColumns.time = BaZiHelper.getTimeColumn(this.fourColumns.day, this.timezi, this.birth, phaseType, this.after23NewDay, this.lateZiHourUseNextDay);
		}else {
			boolean afterHour23 = false;
			if(this.timezi == 0 && this.oldBirthAfter23) {
				afterHour23 = true;
			}
			this.fourColumns.day = BaZiHelper.getDayColumn(this.ad, this.oldBirth, this.zone, afterHour23, phaseType, this.after23NewDay);
			this.fourColumns.time = BaZiHelper.getTimeColumn(this.fourColumns.day, this.oldBirth, phaseType, this.after23NewDay, this.lateZiHourUseNextDay);
		}
		
		this.fourColumns.fillRelative();
		this.fourColumns.minggongMethod = this.minggongMethod;
		this.fourColumns.setupThreeSpec(phaseType, this.sunInfo, this.moonInfo);
		this.fourColumns.setupGanZiTransform();
		this.gong12God = this.fourColumns.setupGong12();
		
		this.season = SeasonHelper.getState(this.fourColumns.month.branch.cell);		
		
		this.tiaohou = TiaoHouHelper.getTiaoHou(this.fourColumns.month.branch.cell, this.fourColumns.day.stem.cell);
	}
	
	
	public FourColumns getFourColums() {
		return fourColumns;
	}
	
	public String getBirth() {
		return this.birth;
	}

	public Map<String, Object> getNongli(){
		return this.nongli;
	}

	public void genLifeMasterDeg(Map<String, Object> chart, String guolaoLifeMode, String sunRiseTime) {
		genLifeMasterDeg(chart, guolaoLifeMode, sunRiseTime, false);
	}

	public void genLifeMasterDeg(Map<String, Object> chart, String guolaoLifeMode, String sunRiseTime, boolean zhengSidereal) {
		if(GUOLAO_LIFE_MODE_YUMAO.equals(guolaoLifeMode)) {
			if(this.genYuMaoLifeMasterDeg(chart, sunRiseTime, zhengSidereal)) {
				return;
			}
		}
		// G/R2 古法遇卯安命:时加太阳顺数至卯 = 日出固定卯时(6:00)的日出安命(复用 yumao,riseHour=6)。
		if(GUOLAO_LIFE_MODE_GUMAO.equals(guolaoLifeMode)) {
			if(this.genYuMaoLifeMasterDeg(chart, "06:00", zhengSidereal)) {
				return;
			}
		}
		// R2 自定命宫:命度法值=地支(子~亥)即手动命宫,命度落该宫太阳同度;其余十二宫/三主/格局随之。
		if(guolaoLifeMode != null && "子丑寅卯辰巳午未申酉戌亥".contains(guolaoLifeMode) && guolaoLifeMode.length() == 1) {
			if(this.genCustomLifeMasterDeg(chart, guolaoLifeMode)) {
				return;
			}
		}
		if(GUOLAO_LIFE_MODE_ASC.equals(guolaoLifeMode)) {
			if(this.genAscLifeMasterDeg(chart)) {
				return;
			}
		}
		if(GUOLAO_LIFE_MODE_COTRANS.equals(guolaoLifeMode)) {
			this.genLifeMasterDeg(chart);
			return;
		}
		this.genLifeMasterDeg(chart);
	}

	// 黄道系命度的 ra 真投影:黄→赤 cotrans(lat=0,type=-1)。
	// 仅供赤仪显示口径读取;安命定义(lon)零改。转换失败回退 lon(=旧占位行为,平滑降级)。
	private double eclipticLonToRa(double lon) {
		return cotransDeg(lon, -1);
	}

	// 赤经命度的黄经反投影:赤→黄 cotrans(lat=0,type=1)。失败回退原值。
	private double raToEclipticLon(double ra) {
		return cotransDeg(ra, 1);
	}

	private double cotransDeg(double deg, int type) {
		try {
			Map<String, Object> param = new HashMap<String, Object>();
			param.put("lon", deg);
			param.put("lat", 0d);
			param.put("type", type);
			Map<String, Object> comap = AstroHelper.getCotrans(param);
			Object val = comap == null ? null : comap.get("lon");
			if(val instanceof Number) {
				return normalizeLon(((Number) val).doubleValue());
			}
		} catch(Exception e) {
		}
		return deg;
	}

	// 黄仪/赤仪显示口径(chart.displayCoord,python 按宿度制宣告;缺省=赤仪旧行为)。
	private boolean isEclipticDisplay(Map<String, Object> chart) {
		return chart != null && "ecliptic".equals(chart.get("displayCoord"));
	}

	// 安命基准度:黄仪=太阳黄经,赤仪=太阳赤经(自定宫/遇卯的宫序判定与宫内落度都随仪制,
	// 用户钦定「不能黄道制下自定命宫却按赤道基准算,反之亦然」)。
	private double sunBaseDeg(Map<String, Object> sun, boolean ecliptic) {
		Object val = ecliptic ? sun.get("lon") : sun.get("ra");
		if(!(val instanceof Number)) {
			val = sun.get("lon");
		}
		return val instanceof Number ? ((Number) val).doubleValue() : 0d;
	}

	// R2 自定命宫:lifeSignIdx = 选定地支的黄道宫序;命度 lon = 该宫起 + 太阳宫内度(同 yumao 命度落法)。
	private boolean genCustomLifeMasterDeg(Map<String, Object> chart, String customZhi) {
		if(customZhi == null || customZhi.trim().isEmpty()) {
			return false;
		}
		// 地支(子~亥)→ 黄道宫序:SignZi(地支→西名) + SignDeg(西名→度)/30。SignList 存的是西名,不可直接 indexOf 地支。
		String signName = StemBranch.SignZi.get(customZhi.trim());
		Integer degBase = signName == null ? null : StemBranch.SignDeg.get(signName);
		if(degBase == null) {
			return false;
		}
		int lifeSignIdx = degBase / 30;
		List<Map<String, Object>> objects = (List<Map<String, Object>>) chart.get("objects");
		Map<String, Object> sun = null;
		for(Map<String, Object> map : objects) {
			if("Sun".equals(map.get("id"))) { sun = map; break; }
		}
		if(sun == null) {
			return false;
		}
		boolean ecliptic = isEclipticDisplay(chart);
		double sunBase = sunBaseDeg(sun, ecliptic);
		double pos = normalizeLon(lifeSignIdx * 30 + (sunBase % 30));
		double lon = ecliptic ? pos : raToEclipticLon(pos);
		double ra = ecliptic ? eclipticLonToRa(pos) : pos;
		Map<String, Object> master = new HashMap<String, Object>();
		master.putAll(sun);
		master.put("lon", lon);
		master.put("ra", ra);
		master.put("sign", StemBranch.SignList.get(lifeSignIdx));
		master.put("signlon", lon % 30);
		master.put("id", "LifeMasterDeg74");
		master.put("type", "GenericCN");
		master.put("house", findHouseForLon(chart, lon));
		// 宿判定按置宿度(与宿度制同口径):黄仪制传 lon,赤仪制传 ra(=pos)。
		fillLifeMasterSu(chart, master, ecliptic ? lon : ra);
		insertLifeMaster(objects, master, lon);
		return true;
	}

	public void genLifeMasterDeg(Map<String, Object> chart) {
		List<Map<String, Object>> objects = (List<Map<String, Object>>) chart.get("objects");
		Map<String, Object> sun = null;
		for(Map<String, Object> map : objects) {
			String id = (String) map.get("id");
			if(id.equals("Sun")) {
				sun = map;
				break;
			}
		}
		if(sun == null) {
			return;
		}
		
		double sunra = (double) sun.get("ra");
		double sundecl = (double) sun.get("decl");
		
		String timezi = this.fourColumns.time.branch.cell;
		String timesig = StemBranch.SignZi.get(timezi);
		int tmsigidx = StemBranch.SignDeg.get(timesig) / 30;
		int sunidx = ConvertUtility.getValueAsInt(sunra / 30);
		int idx = (sunidx - tmsigidx - 5 + 24) % 12;
		String zi = StemBranch.SignList.get(idx);
		int deg = StemBranch.SignDeg.get(zi);
		double ra = deg + (sunra % 30);
		
		Map<String, Object> param = new HashMap<String, Object>();
		param.put("lon", ra);
		param.put("lat", sundecl);
		param.put("type", 1);
		Map<String, Object> comap = AstroHelper.getCotrans(param);
		
		double lon = (double) comap.get("lon");
		double lat = (double) comap.get("lat");
		lon = normalizeLon(lon);
		int eclipsignIdx = ConvertUtility.getValueAsInt(lon / 30);
		if(eclipsignIdx < 0 || eclipsignIdx >= StemBranch.SignList.size()) {
			eclipsignIdx = ((eclipsignIdx % 12) + 12) % 12;
		}
		
		String sunhouse = (String) sun.get("house");
		double sunlon = (double) sun.get("lon");
		int sunhidx = ConvertUtility.getValueAsInt(sunhouse.substring(4, 5)) - 1;
		int hdelta = ConvertUtility.getValueAsInt((lon - sunlon)/30);
		int hidx = (sunhidx + hdelta + 12) % 12 + 1;
		
		
		Map<String, Object> master = new HashMap<String, Object>();
		master.putAll(sun);
		master.put("lon", lon);
		master.put("lat", lat);
		master.put("ra", ra);
		master.put("sign", StemBranch.SignList.get(eclipsignIdx));
		master.put("signlon", lon % 30);
		master.put("id", "LifeMasterDeg74");
		master.put("type", "GenericCN");
		master.put("house", "House" + hidx);
		
		List<Map<String, Object>> su28 = (List<Map<String, Object>>) chart.get("fixedStarSu28");
		Map<String, Object> star = null;
		for(Map<String, Object> su : su28) {
			double sura = (double) su.get("ra");
			if(sura <= ra) {
				star = su;
			}else {
				break;
			}
		}
		if(star == null) {
			star = su28.get(27);
		}
		master.put("su28", star.get("name"));
		
		int su27idx = ConvertUtility.getValueAsInt((lon / 13.3333333));
		if(su27idx < 0) {
			su27idx = 0;
		}else if(su27idx >= StemBranch.Su27.size()) {
			su27idx = StemBranch.Su27.size() - 1;
		}
		master.put("su", StemBranch.Su27.get(su27idx));
		
		int pos = 0;
		for(Map<String, Object> obj : objects) {
			double objlon = (double) obj.get("lon");
			if(objlon > lon) {
				break;
			}
			pos++;
		}
		objects.add(pos, master);
	}

	private boolean genAscLifeMasterDeg(Map<String, Object> chart) {
		List<Map<String, Object>> objects = (List<Map<String, Object>>) chart.get("objects");
		Map<String, Object> asc = null;
		for(Map<String, Object> map : objects) {
			String id = (String) map.get("id");
			if(id.equals("Asc")) {
				asc = map;
				break;
			}
		}
		if(asc == null) {
			return false;
		}

		double lon = normalizeLon(ConvertUtility.getValueAsDouble(asc.get("lon")));
		Map<String, Object> master = new HashMap<String, Object>();
		master.putAll(asc);
		master.put("lon", lon);
		master.put("signlon", lon % 30);
		master.put("id", "LifeMasterDeg74");
		master.put("type", "GenericCN");
		master.put("house", asc.get("house") == null ? findHouseForLon(chart, lon) : asc.get("house"));
		fillLifeMasterSu(chart, master, lon, ConvertUtility.getValueAsDouble(master.get("ra"), lon));
		insertLifeMaster(objects, master, lon);
		return true;
	}

	private boolean genYuMaoLifeMasterDeg(Map<String, Object> chart, String sunRiseTime, boolean useRawBirthTime) {
		List<Map<String, Object>> objects = (List<Map<String, Object>>) chart.get("objects");
		Map<String, Object> sun = null;
		for(Map<String, Object> map : objects) {
			String id = (String) map.get("id");
			if(id.equals("Sun")) {
				sun = map;
				break;
			}
		}
		if(sun == null || sunRiseTime == null || sunRiseTime.trim().equals("")) {
			return false;
		}

		double riseHour = parseHourValue(sunRiseTime);
		if(riseHour < 0) {
			return false;
		}

		boolean ecliptic = isEclipticDisplay(chart);
		double sunBase = sunBaseDeg(sun, ecliptic);
		int[] timeParts = useRawBirthTime ? this.oldBirthParts : this.birthParts;
		double birthHour = timeParts[3] + timeParts[4] / 60.0 + timeParts[5] / 3600.0;
		double signProbe = normalizeLon(sunBase - (riseHour - birthHour) * 15.0);
		int lifeSignIdx = ConvertUtility.getValueAsInt(signProbe / 30);
		if(lifeSignIdx < 0 || lifeSignIdx >= StemBranch.SignList.size()) {
			lifeSignIdx = ((lifeSignIdx % 12) + 12) % 12;
		}
		double pos = normalizeLon(lifeSignIdx * 30 + (sunBase % 30));
		double lon = ecliptic ? pos : raToEclipticLon(pos);
		double ra = ecliptic ? eclipticLonToRa(pos) : pos;

		Map<String, Object> master = new HashMap<String, Object>();
		master.putAll(sun);
		master.put("lon", lon);
		master.put("ra", ra);
		master.put("sign", StemBranch.SignList.get(lifeSignIdx));
		master.put("signlon", lon % 30);
		master.put("id", "LifeMasterDeg74");
		master.put("type", "GenericCN");
		master.put("house", findHouseForLon(chart, lon));
		// 宿判定按置宿度(与宿度制同口径):黄仪制传 lon,赤仪制传 ra(=pos)。
		fillLifeMasterSu(chart, master, ecliptic ? lon : ra);
		insertLifeMaster(objects, master, lon);
		return true;
	}

	private double parseHourValue(String time) {
		if(time == null) {
			return -1;
		}
		String val = time.trim();
		if(val.length() < 2) {
			return -1;
		}
		String[] parts = val.split(":");
		double hour = ConvertUtility.getValueAsDouble(parts[0], -1);
		if(hour < 0) {
			return -1;
		}
		double minute = parts.length > 1 ? ConvertUtility.getValueAsDouble(parts[1], 0) : 0;
		double second = parts.length > 2 ? ConvertUtility.getValueAsDouble(parts[2], 0) : 0;
		return hour + minute / 60.0 + second / 3600.0;
	}

	private String findHouseForLon(Map<String, Object> chart, double lon) {
		List<Map<String, Object>> houses = (List<Map<String, Object>>) chart.get("houses");
		if(houses == null || houses.isEmpty()) {
			return "House1";
		}
		int hidx = 1;
		for(Map<String, Object> house : houses) {
			double houseLon = normalizeLon(ConvertUtility.getValueAsDouble(house.get("lon")));
			double nextLon = normalizeLon(houseLon + ConvertUtility.getValueAsDouble(house.get("size"), 30));
			boolean inHouse = houseLon <= nextLon ? lon >= houseLon && lon < nextLon : lon >= houseLon || lon < nextLon;
			if(inHouse) {
				return (String) house.get("id");
			}
			hidx++;
		}
		return "House1";
	}

	private void fillLifeMasterSu(Map<String, Object> chart, Map<String, Object> master, double lon) {
		fillLifeMasterSu(chart, master, lon, lon);
	}

	private void fillLifeMasterSu(Map<String, Object> chart, Map<String, Object> master, double lon, double suDegree) {
		List<Map<String, Object>> su28 = (List<Map<String, Object>>) chart.get("fixedStarSu28");
		if(su28 != null && !su28.isEmpty()) {
			Map<String, Object> star = null;
			for(Map<String, Object> su : su28) {
				double sura = ConvertUtility.getValueAsDouble(su.get("ra"));
				if(sura <= suDegree) {
					star = su;
				}else {
					break;
				}
			}
			if(star == null) {
				star = su28.get(su28.size() - 1);
			}
			master.put("su28", star.get("name"));
		}

		int su27idx = ConvertUtility.getValueAsInt((lon / 13.3333333));
		if(su27idx < 0) {
			su27idx = 0;
		}else if(su27idx >= StemBranch.Su27.size()) {
			su27idx = StemBranch.Su27.size() - 1;
		}
		master.put("su", StemBranch.Su27.get(su27idx));
	}

	private void insertLifeMaster(List<Map<String, Object>> objects, Map<String, Object> master, double lon) {
		int pos = 0;
		for(Map<String, Object> obj : objects) {
			double objlon = ConvertUtility.getValueAsDouble(obj.get("lon"));
			if(objlon > lon) {
				break;
			}
			pos++;
		}
		objects.add(pos, master);
	}
	
	private void setupGua() {
		FourColumns fourCols = this.fourColumns;
		String month = fourCols.month.branch.cell;
	
		for(int i=0; i<fourCols.fourZhu.length; i++) {
			GanZi gz = fourCols.fourZhu[i];
			String gan = gz.stem.cell;
			String zi = gz.branch.cell;
			if(gan.equals("戊") || gan.equals("己")) {
				if(i == 4) { // 这个是胎元
					gan = gan + zi;					
				}else {
					gan = gan + month;
				}
			}
			Map<String, Object> gangua = GuaHelper.getMeiyiGanZiGua(gan);
			Map<String, Object> zigua = GuaHelper.getMeiyiGanZiGua(zi);
			gz.setupGanGua(gangua);
			gz.setupZhiGua(zigua);
			
			String upname = (String) gangua.get("name");
			String downname = (String) zigua.get("name");
			gz.gua64 = GuaHelper.getGua(upname + downname);
			gz.tongGua = GuaHelper.getTongGua(gz.gua64);
			
			HuGua hugua = GuaHelper.getHuGua(upname, downname);
			gz.huGuaUp = hugua.up;
			gz.huGuaDown = hugua.down;
			gz.huGua = hugua.gua64;
			
		}
	}

	public static void main(String[] args) {
		String dtstr = "1976-07-06 21:11:00";
//		dtstr = "1-06-10 11:20:38";
//		dtstr = "1-01-01 11:20:38";
//		dtstr = "1500-02-28 11:20:38";
//		dtstr = "1-06-10 11:20:38";
//		dtstr = "1995-09-30 01:10:00";
//		dtstr = "2019-10-09 16:00";
//		dtstr = "2021-02-03 23:58:55";
//		dtstr = "2021-02-07 17:03:29";
//		dtstr = "-433-02-11 08:00:00";
		dtstr = "-5049-07-20 08:00:00";
		
		String zone = "+08:00";
		String lon = "118e32";
		String lat = "36n37";
		
		lon = "108e27";
		lat = "34s03";

		lon = "119e18";
		lat = "26n05";
	
		int ad = 1;
		if(dtstr.startsWith("-")) {
			ad = -1;
		}
		
		BaZi bz = new BaZi(ad, dtstr, zone, lon, lat, TimeZiAlg.RealSun, false, GodRule.ZhuRi, false, true);
		bz.calculate(PhaseType.HuoTu);
		
		
		String json = JsonUtility.encodePretty(bz);
		System.out.println(json);
	}
	
}
