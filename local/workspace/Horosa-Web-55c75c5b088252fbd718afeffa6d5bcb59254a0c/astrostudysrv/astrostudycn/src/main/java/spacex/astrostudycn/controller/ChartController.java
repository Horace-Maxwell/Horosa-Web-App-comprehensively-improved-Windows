package spacex.astrostudycn.controller;


import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;
import spacex.astrostudy.helper.AstroHelper;
import spacex.astrostudy.helper.NongliHelper;
import spacex.astrostudy.helper.ParamHashCacheHelper;
import spacex.astrostudy.helper.predict.PlanetSignPredictHelper;
import spacex.astrostudycn.model.OnlyFourColumns;

@Controller
public class ChartController {

	// 运行时版本号:并入 /chart 等盘的 paramhash 缓存键。开持久化缓存后,一旦 Python 计算引擎
	// 升级(runtime payload 换版)但参数不变,旧版缓存盘必须自动失效——否则会返回陈旧盘面。
	// 必须与 Horosa_Desktop_Installer/config/release_config.json 的 runtimeVersion 字段保持 lockstep
	// (preflight [65] 会比对二者一致;升级 runtime 时同步改这里)。_wireRev 只在 PD 接线变更时手动 bump,
	// 不覆盖"算法升级但接线不变"这一类陈旧场景,故另立运行时版本闸。
	private static final String RUNTIME_VERSION = "3.3.4-runtime4";

	// v3.0.1 perf B0:/chart 逐段计时标记(也用作重建 jar 的存在性哨兵)。纯观测——只在 perf 日志打
	// 各段耗时(Python 底盘 / 八字农历 / 盘装配 / 行星预测 / 推运同步),不改任何计算与返回值,便于在
	// 真机看清「单盘 2-3s」的真实构成、指导后续按热点优化(功能零影响)。
	private static final String CHART_PERF_SEG_REV = "chart_perf_seg_v1";

	private static final int SU28_MODE_ZHENG_SIDEREAL = 4;
	private static final double ZHENG_AYANAMSHA_BASE_DEGREE = 4.0;
	private static final double ZHENG_AYANAMSHA_BASE_YEAR = 1300.0;
	private static final double PRECESSION_DEGREE_PER_YEAR = 50.290966 / 3600.0;
	private static final String[] ZHENG_SU28_NAMES = new String[] {
		"娄", "胃", "昴", "毕", "觜", "参", "井", "鬼", "柳", "星", "张", "翼", "轸", "角",
		"亢", "氐", "房", "心", "尾", "箕", "斗", "牛", "女", "虚", "危", "室", "壁", "奎"
	};
	private static final double[] ZHENG_SIDEREAL_STELLAR_RA = new double[] {
		15.9, 26.3, 41.1, 53.2, 69.0, 70.0, 81.8, 112.3, 115.2, 130.5, 136.4, 151.4, 170.1, 187.2,
		200.0, 208.9, 225.2, 230.6, 237.0, 255.6, 266.3, 290.1, 298.0, 308.9, 318.3, 333.6, 349.4, 358.3
	};

	@ResponseBody
	@RequestMapping("/chart")
	public void chart(){
		Map<String, Object> params = getParams();
		Map<String, Object> keyparams = new HashMap<String, Object>();
		keyparams.putAll(params);
		keyparams.remove("gpsLat");
		keyparams.remove("gpsLon");
		Object obj = ParamHashCacheHelper.get("/chart", keyparams, (args)->{
			long _pt0 = System.currentTimeMillis();
			Map<String, Object> astroArgs = args;
			if(ConvertUtility.getValueAsInt(args.get("doubingSu28"), 0) == SU28_MODE_ZHENG_SIDEREAL) {
				astroArgs = new HashMap<String, Object>();
				astroArgs.putAll(args);
				astroArgs.put("zodiacal", 1);
				astroArgs.put("guolaoZhengSidereal", 1);
			}
			Map<String, Object> res = AstroHelper.getChart(astroArgs);
			long _ptPy = System.currentTimeMillis();
			Map<String, Object> reqparams = (Map<String, Object>) res.get("params");
			if(reqparams != null) {
				reqparams.put("doubingSu28", args.get("doubingSu28"));
				if(args.containsKey("guolaoLifeMode")) {
					reqparams.put("guolaoLifeMode", args.get("guolaoLifeMode"));
					reqparams.put("_guolaoLifeRev", "life_cotrans_v4");
				}
				if(ConvertUtility.getValueAsInt(args.get("doubingSu28"), 0) == SU28_MODE_ZHENG_SIDEREAL) {
					reqparams.put("zodiacal", 1);
					reqparams.put("guolaoZhengSidereal", 1);
				}
			}
			int ad = ConvertUtility.getValueAsInt(args.get("ad"), 1);
			String zone = ConvertUtility.getValueAsString(args.get("zone"));
			String lon = ConvertUtility.getValueAsString(args.get("lon"));
			String lat = ConvertUtility.getValueAsString(args.get("lat"));
			String dtstr = String.format("%s %s", args.get("date"), args.get("time"));
			boolean after23NewDay = ConvertUtility.getValueAsInt(args.get("after23NewDay"), 1) == 1;
			boolean lateZiHourUseNextDay = ConvertUtility.getValueAsInt(args.get("lateZiHourUseNextDay"), 1) == 1;
			OnlyFourColumns bz = new OnlyFourColumns(ad, dtstr, zone, lon, lat, after23NewDay, spacex.astrostudycn.constants.BaZiGender.Male, spacex.astrostudycn.constants.TimeZiAlg.RealSun, false, lateZiHourUseNextDay);
			Map<String, Object> map = toPlainMap(bz.getNongli());
			if(res.containsKey("chart")) {
				Map<String, Object> chart = (Map<String, Object>) res.get("chart");
				String guolaoLifeMode = ConvertUtility.getValueAsString(args.get("guolaoLifeMode"));
				String guolaoSunRiseTime = reqparams == null ? null : ConvertUtility.getValueAsString(reqparams.get("guolaoSunRiseTime"));
				boolean zhengSidereal = ConvertUtility.getValueAsInt(args.get("doubingSu28"), 0) == SU28_MODE_ZHENG_SIDEREAL
					|| ConvertUtility.getValueAsInt(args.get("guolaoZhengSidereal"), 0) == 1;
				bz.genLifeMasterDeg(chart, guolaoLifeMode, guolaoSunRiseTime, zhengSidereal);
				applyZhengSiderealSu28(chart, args);
				chart.put("nongli", map);
			}else {
				res.put("nongli", map);
			}
			long _ptBz = System.currentTimeMillis();

			PlanetSignPredictHelper.predictPlanetSign(res);
			long _ptSign = System.currentTimeMillis();
			syncPredictiveMetaAndRows(res, args);
			long _ptPd = System.currentTimeMillis();
			// B0(写 perf/perf.log):/chart 逐段耗时,纯观测、不改结果与控制流。让真机一眼看清「单盘 2-3s」
			// 的构成(Python 底盘 / 八字农历+装配 / 行星预测 / 推运同步),据此按热点做后续优化。
			// CHART_PERF_SEG_REV 兼作重建 jar 的存在性哨兵标记。
			// PERF-R7 P1-1:debug→info——perf appender 阈值高于 debug,导致真机 perf.log 恒空、
			// 观测断粮(v3.2.1 复盘实证);info 级每请求一行,量级与 access log 相当,无性能顾虑。
			QueueLog.info(AppLoggers.Performance,
				"/chart seg ms python={} baziAssemble={} predictSign={} predSync={} total={} rev={}",
				(_ptPy - _pt0), (_ptBz - _ptPy), (_ptSign - _ptBz), (_ptPd - _ptSign), (_ptPd - _pt0), CHART_PERF_SEG_REV);
			return res;
		});
		
		Map<String, Object> res = (Map<String, Object>)obj;
		setupGps(res);
		TransData.set(res);
	}
	
	@ResponseBody
	@RequestMapping("/chart13")
	public void chart13(){
		Map<String, Object> params = getParams();
		Map<String, Object> keyparams = new HashMap<String, Object>();
		keyparams.putAll(params);
		keyparams.remove("gpsLat");
		keyparams.remove("gpsLon");
		Object obj = ParamHashCacheHelper.get("/chart13", keyparams, (args)->{
			Map<String, Object> res = AstroHelper.getChart13(args);
			int ad = ConvertUtility.getValueAsInt(args.get("ad"), 1);
			NongliHelper.fillNongli(res, args, ad);
			syncPredictiveMetaAndRows(res, args);
			return res;
		});
		
		Map<String, Object> res = (Map<String, Object>)obj;
		setupGps(res);
		TransData.set(res);
	}

	@ResponseBody
	@RequestMapping("/chart12")
	public void chart12(){
		Map<String, Object> params = getParams();
		Map<String, Object> keyparams = new HashMap<String, Object>();
		keyparams.putAll(params);
		keyparams.remove("gpsLat");
		keyparams.remove("gpsLon");
		Object obj = ParamHashCacheHelper.get("/chart12", keyparams, (args)->{
			Map<String, Object> res = AstroHelper.getChart12(args);
			int ad = ConvertUtility.getValueAsInt(args.get("ad"), 1);
			NongliHelper.fillNongli(res, args, ad);
			syncPredictiveMetaAndRows(res, args);
			return res;
		});

		Map<String, Object> res = (Map<String, Object>)obj;
		setupGps(res);
		TransData.set(res);
	}

	private void setupGps(Map<String, Object> res) {
		Map<String, Object> reqparams = (Map<String, Object>) res.get("params");
		if(reqparams != null) {
			reqparams.put("gpsLat", TransData.get("gpsLat"));
			reqparams.put("gpsLon", TransData.get("gpsLon"));
		}
	}

	// 把 OnlyFourColumns.getNongli() 的结果(内含裸 FourColumns/FateDirect[] POJO)经 JsonUtility
	// round-trip 成纯 Map/List/标量。这是 /chart 持久化缓存生效的关键:ParamHashCacheHelper.canPersistLocal
	// 只接受纯类型,遇 POJO 则整条响应拒写磁盘(故 _chart 缓存目录长期 0 条,每次冷算 1.3-2.3s)。
	// 序列化走与响应出口(JsonConverter→JsonUtility.encodePretty)同一个 Jackson jsonMapper(同 visibility、
	// 同 transient 排除、同字段声明序),反序列化得保留键序的 LinkedHashMap → 再被同 mapper 序列化时
	// 与"直接序列化 POJO"逐字节一致(纯 Map 是该序列化的不动点)。即冷算注入纯 Map 与改前直出 POJO、
	// 与热读缓存反序列化,三者响应 byte 相同;对齐 chart13 的 nl.toMap() 范式。round-trip 失败则原样
	// 返回(至少不比改前差:仍走内存缓存,只是磁盘不持久化),绝不影响盘面正确性。
	private Map<String, Object> toPlainMap(Map<String, Object> map) {
		if(map == null) {
			return null;
		}
		try {
			Object plain = JsonUtility.decode(JsonUtility.encode(map), Object.class);
			if(plain instanceof Map) {
				return (Map<String, Object>) plain;
			}
		}catch(Exception e) {
			// round-trip 失败(理论上不会):退回原 map,保正确性,仅丢磁盘持久化。
		}
		return map;
	}

	private void applyZhengSiderealSu28(Map<String, Object> chart, Map<String, Object> args) {
		if(chart == null || args == null || ConvertUtility.getValueAsInt(args.get("doubingSu28"), 0) != SU28_MODE_ZHENG_SIDEREAL) {
			return;
		}
		double ayanamsha = zhengAyanamsha(args);
		List<Map<String, Object>> stars = new ArrayList<Map<String, Object>>();
		for(int i=0; i<ZHENG_SU28_NAMES.length; i++) {
			Map<String, Object> row = new HashMap<String, Object>();
			row.put("name", ZHENG_SU28_NAMES[i]);
			row.put("ra", normalizeDegree(ZHENG_SIDEREAL_STELLAR_RA[i]));
			row.put("siderealRa", ZHENG_SIDEREAL_STELLAR_RA[i]);
			row.put("source", "zheng-sidereal");
			stars.add(row);
		}
		Collections.sort(stars, new Comparator<Map<String, Object>>() {
			@Override
			public int compare(Map<String, Object> a, Map<String, Object> b) {
				return Double.compare(number(a.get("ra"), 0), number(b.get("ra"), 0));
			}
		});
		chart.put("fixedStarSu28", stars);
		chart.put("su28Mode", SU28_MODE_ZHENG_SIDEREAL);
		chart.put("su28ModeName", "郑式恒星制");
		chart.put("su28Ayanamsha", ayanamsha);

		Object rawObjects = chart.get("objects");
		if(!(rawObjects instanceof List)) {
			return;
		}
		List<Map<String, Object>> objects = (List<Map<String, Object>>) rawObjects;
		for(Map<String, Object> obj : objects) {
			double ra = normalizeDegree(number(obj.get("ra"), number(obj.get("lon"), 0)));
			Map<String, Object> star = su28ForDegree(stars, ra);
			if(star != null) {
				obj.put("su28", star.get("name"));
				obj.put("su28Mode", "zheng-sidereal");
			}
		}
	}

	private Map<String, Object> su28ForDegree(List<Map<String, Object>> stars, double ra) {
		if(stars == null || stars.isEmpty()) {
			return null;
		}
		Map<String, Object> star = stars.get(stars.size() - 1);
		for(Map<String, Object> item : stars) {
			if(number(item.get("ra"), 0) <= ra) {
				star = item;
			}else {
				break;
			}
		}
		return star;
	}

	private double zhengAyanamsha(Map<String, Object> args) {
		return normalizeDegree(ZHENG_AYANAMSHA_BASE_DEGREE
			+ (decimalYear(args) - ZHENG_AYANAMSHA_BASE_YEAR) * PRECESSION_DEGREE_PER_YEAR);
	}

	private double decimalYear(Map<String, Object> args) {
		String date = ConvertUtility.getValueAsString(args.get("date"));
		int ad = ConvertUtility.getValueAsInt(args.get("ad"), 1);
		date = date == null ? "" : date.trim().replace('/', '-');
		boolean negative = date.startsWith("-");
		if(negative) {
			date = date.substring(1);
		}
		String[] parts = date.split("-");
		int year = parts.length > 0 ? ConvertUtility.getValueAsInt(parts[0], 2000) : 2000;
		int month = parts.length > 1 ? ConvertUtility.getValueAsInt(parts[1], 1) : 1;
		int day = parts.length > 2 ? ConvertUtility.getValueAsInt(parts[2], 1) : 1;
		if(negative || ad < 0) {
			year = -Math.abs(year);
		}
		month = Math.max(1, Math.min(12, month));
		day = Math.max(1, Math.min(31, day));
		return year + ((month - 1) * 30.4375 + (day - 1)) / 365.25;
	}

	private double normalizeDegree(double val) {
		double res = val % 360.0;
		return res < 0 ? res + 360.0 : res;
	}

	private double number(Object obj, double def) {
		if(obj instanceof Number) {
			return ((Number) obj).doubleValue();
		}
		try{
			return Double.parseDouble(ConvertUtility.getValueAsString(obj));
		}catch(Exception ex) {
			return def;
		}
	}

	private void syncPredictiveMetaAndRows(Map<String, Object> res, Map<String, Object> args) {
		if(res == null || args == null) {
			return;
		}
		Map<String, Object> reqparams = (Map<String, Object>) res.get("params");
		if(reqparams != null) {
			reqparams.put("pdSyncRev", "pd_method_sync_v8");
			reqparams.put("showPdBounds", ConvertUtility.getValueAsInt(args.get("showPdBounds"), 1));
			if(args.containsKey("pdtype")) {
				reqparams.put("pdtype", args.get("pdtype"));
			}
			if(args.containsKey("pdMethod")) {
				reqparams.put("pdMethod", args.get("pdMethod"));
			}
			if(args.containsKey("pdTimeKey")) {
				reqparams.put("pdTimeKey", args.get("pdTimeKey"));
			}
			// 回显主限进阶参数,便于前端 needsPdRecompute 比对已落库值(否则 pdYears 改后会被判为"需重算"反复 fetch)。
			if(args.containsKey("pdYears")) {
				reqparams.put("pdYears", args.get("pdYears"));
			}
			if(args.containsKey("pdDirect")) {
				reqparams.put("pdDirect", args.get("pdDirect"));
			}
			if(args.containsKey("pdConverse")) {
				reqparams.put("pdConverse", args.get("pdConverse"));
			}
			if(args.containsKey("pdAntiscia")) {
				reqparams.put("pdAntiscia", args.get("pdAntiscia"));
			}
			if(args.containsKey("pdTerms")) {
				reqparams.put("pdTerms", args.get("pdTerms"));
			}
		}

		if(!ConvertUtility.getValueAsBool(args.get("predictive"), false)) {
			return;
		}
		if(!ConvertUtility.getValueAsBool(args.get("includePrimaryDirection"), false)) {
			return;
		}
		// 去冗余 PD:Python /chart(getPredictivesObj)在 includePrimaryDirection 时已原生返回
		// predictives.primaryDirection,且其值与 /predict/pd 的 pd 字节完全一致(同一
		// PerChart(data).getPredict().getPrimaryDirection())。已有非空就直接复用,跳过第二次
		// /predict/pd 往返(主限法昂贵,曾算两遍)。仅当缺失/为空才补打,保前端读结构不变。
		Map<String, Object> predictives = (Map<String, Object>) res.get("predictives");
		if(predictives != null && hasNonEmptyPrimaryDirection(predictives.get("primaryDirection"))) {
			return;
		}
		Map<String, Object> pdres = AstroHelper.getPrimaryDirection(args);
		if(pdres == null || !pdres.containsKey("pd")) {
			return;
		}
		if(predictives == null) {
			predictives = new HashMap<String, Object>();
			res.put("predictives", predictives);
		}
		predictives.put("primaryDirection", pdres.get("pd"));
	}

	private boolean hasNonEmptyPrimaryDirection(Object pd) {
		if(pd instanceof Collection) {
			return !((Collection<?>) pd).isEmpty();
		}
		if(pd instanceof Map) {
			return !((Map<?, ?>) pd).isEmpty();
		}
		return pd != null;
	}
	
	private Map<String, Object> getParams(){
		Map<String, Object> params = new HashMap<String, Object>();
		if(!TransData.containsParam("date")) {
			throw new ErrorCodeException(100001, "miss.date");
		}
		if(!TransData.containsParam("time")) {
			throw new ErrorCodeException(100002, "miss.time");
		}
		if(!TransData.containsParam("zone")) {
			throw new ErrorCodeException(100003, "miss.zone");
		}
		if(!TransData.containsParam("lat")) {
			throw new ErrorCodeException(100004, "miss.lat");
		}
		if(!TransData.containsParam("lon")) {
			throw new ErrorCodeException(100005, "miss.lon");
		}
		params.put("date", TransData.get("date"));
		params.put("time", TransData.get("time"));
		if(TransData.containsParam("ad")) {
			int ad = TransData.getValueAsInt("ad", 1);
			params.put("ad", ad);
			if(ad != 1) {
				String dt = TransData.getValueAsString("date");
				if(dt.indexOf('-') != 0) {
					params.put("date", "-" + dt);
				}
			}			
		}else {
			String dt = TransData.getValueAsString("date");
			if(dt.indexOf('-') == 0) {
				params.put("ad", -1);
			}
		}
		params.put("zone", TransData.get("zone"));
		params.put("lat", TransData.get("lat"));
		params.put("lon", TransData.get("lon"));
		// Bust legacy local/runtime cache entries after PD method/time-key response wiring changes.
		params.put("_wireRev", "pd_method_sync_v12");
		// 运行时版本闸:并入缓存键,使 Python 引擎升级(runtime payload 换版)后旧持久化缓存自动失效。
		params.put("_runtimeVer", RUNTIME_VERSION);
		if(TransData.containsParam("_su28Rev")) {
			params.put("_su28Rev", TransData.get("_su28Rev"));
		}
		params.put("hsys", TransData.getValueAsInt("hsys", 0));
		params.put("tradition", TransData.getValueAsBool("tradition", false));
		// 界系(termsVariant 0埃及/1托勒密/2莉莉)必须透传:既进 keyparams(缓存键,否则切界返旧缓存盘)
		// 又进 Python compute(perchart 读 termsVariant 换 essential.TERMS);不传=默认埃及,零回归(同 pd*/岁差 透传坑)。
		if(TransData.containsParam("termsVariant")) {
			params.put("termsVariant", TransData.get("termsVariant"));
		}
		params.put("doubingSu28", getSu28Mode());
		if(TransData.containsParam("guolaoLifeMode")) {
			params.put("guolaoLifeMode", TransData.get("guolaoLifeMode"));
			params.put("_guolaoLifeRev", "life_cotrans_v5_gumao_custom");
		}
		params.put("strongRecption", TransData.getValueAsBool("strongRecption", false));
		params.put("virtualPointReceiveAsp", TransData.getValueAsBool("virtualPointReceiveAsp", false));
		params.put("simpleAsp", TransData.getValueAsBool("simpleAsp", false));
		if(TransData.containsParam("orbs")) {
			params.put("orbs", TransData.get("orbs"));
		}
		if(TransData.containsParam("orbScale")) {
			params.put("orbScale", TransData.get("orbScale"));
		}
		params.put("predictive", TransData.getValueAsBool("predictive", true));
		params.put("includePrimaryDirection", TransData.getValueAsBool("includePrimaryDirection", false));
		params.put("southchart", TransData.getValueAsBool("southchart", false));
		if(TransData.containsParam("pdaspects")) {
			Object aspobj = TransData.get("pdaspects");
			if(aspobj instanceof String) {
				aspobj = JsonUtility.decodeList((String)aspobj, String.class);
			}
			params.put("pdaspects", aspobj);
		}
		if(TransData.containsParam("pdtype")) {
			params.put("pdtype", TransData.get("pdtype"));
		}
		if(TransData.containsParam("pdMethod")) {
			params.put("pdMethod", TransData.get("pdMethod"));
		}
		if(TransData.containsParam("pdTimeKey")) {
			params.put("pdTimeKey", TransData.get("pdTimeKey"));
		}
		// 主限法进阶参数:推算年数 + 顺逆/映点/界。/chart(含 includePrimaryDirection)内部走
		// getPrimaryDirection(args) 复算主限,这些键必须透传给 Python compute(perchart.py 读 pdYears/
		// pdDirect/pdConverse/pdAntiscia/pdTerms),否则 AI 挂载侧「每技法设置」改了年数/方向不生效
		// (选项与快照对不上)。与 PredictiveController(/predict/pd)的透传口径保持一致。
		if(TransData.containsParam("pdYears")) {
			params.put("pdYears", TransData.get("pdYears"));
		}
		if(TransData.containsParam("pdDirect")) {
			params.put("pdDirect", TransData.get("pdDirect"));
		}
		if(TransData.containsParam("pdConverse")) {
			params.put("pdConverse", TransData.get("pdConverse"));
		}
		if(TransData.containsParam("pdAntiscia")) {
			params.put("pdAntiscia", TransData.get("pdAntiscia"));
		}
		if(TransData.containsParam("pdTerms")) {
			params.put("pdTerms", TransData.get("pdTerms"));
		}
		if(TransData.containsParam("zodiacal")) {
			params.put("zodiacal", TransData.get("zodiacal"));
		}else {
			params.put("zodiacal", 0);
		}
		// 恒星黄道岁差(ayanāṃśa):必须显式转发给 Python(perchart 读 siderealAyanamsa 解析 SE 模式),
		// 否则前端选的 Raman/Fagan 等被 getParams 丢弃 → 永远落 Lahiri 默认、度数不变(同 pd* 透传坑)。
		if(TransData.containsParam("siderealAyanamsa")) {
			params.put("siderealAyanamsa", TransData.get("siderealAyanamsa"));
		}
		// 七政四余 G6/G10-13:报时星太阳时(真/平/关)+ 四余取法(罗计交点真平/月孛远地点真平/紫炁今法立成)。
		// 必须透传 Python(perchart 读),缺=默认零回归(同 termsVariant/siderealAyanamsa 透传坑)。
		if(TransData.containsParam("trueSolarTime")) {
			params.put("trueSolarTime", TransData.get("trueSolarTime"));
		}
		if(TransData.containsParam("guolaoNodeType")) {
			params.put("guolaoNodeType", TransData.get("guolaoNodeType"));
		}
		if(TransData.containsParam("guolaoLilithType")) {
			params.put("guolaoLilithType", TransData.get("guolaoLilithType"));
		}
		if(TransData.containsParam("guolaoZiqiMode")) {
			params.put("guolaoZiqiMode", TransData.get("guolaoZiqiMode"));
		}
		// 七政四余 授时历古法(用制 6):推变黄道术法(纪元/进退/会圆)+ 古宿随岁差。
		// 必须透传 Python(perchart 读 guolaoTuibianMethod/guolaoGufaPrecess),缺=纪元闭式·不随岁差默认(同上透传坑)。
		if(TransData.containsParam("guolaoTuibianMethod")) {
			params.put("guolaoTuibianMethod", TransData.get("guolaoTuibianMethod"));
		}
		if(TransData.containsParam("guolaoGufaPrecess")) {
			params.put("guolaoGufaPrecess", TransData.get("guolaoGufaPrecess"));
		}
		// 额外档 赤道回归制(用制 7)黄道零点锚定(牛前冬至/春分壁2.3),透传 Python(perchart 读 guolaoEqTropicalAnchor),缺=牛前冬至零回归。
		if(TransData.containsParam("guolaoEqTropicalAnchor")) {
			params.put("guolaoEqTropicalAnchor", TransData.get("guolaoEqTropicalAnchor"));
		}
		// 占星(希腊化)G12/G13/G15/G20-P2:西占月交点真平 + 区分昼夜缓冲 + 迦勒底界狮子首星 + 流派后端变体
		// (三分集/福点反转)。必须透传 Python(perchart 读),缺=默认零回归(同 termsVariant/guolao* 透传坑);
		// 既进 keyparams(缓存键,否则切档返旧缓存盘)又进 Python compute。
		if(TransData.containsParam("westNodeType")) {
			params.put("westNodeType", TransData.get("westNodeType"));
		}
		if(TransData.containsParam("sectBuffer")) {
			params.put("sectBuffer", TransData.get("sectBuffer"));
		}
		if(TransData.containsParam("leoBoundFirst")) {
			params.put("leoBoundFirst", TransData.get("leoBoundFirst"));
		}
		if(TransData.containsParam("triplicity")) {
			params.put("triplicity", TransData.get("triplicity"));
		}
		if(TransData.containsParam("lotReversal")) {
			params.put("lotReversal", TransData.get("lotReversal"));
		}
		if(TransData.containsParam("gpsLat")) {
			params.put("gpsLat", TransData.get("gpsLat"));
			params.put("gpsLon", TransData.get("gpsLon"));
		}
		// 日界点 + 晚子时·时柱起干 参数:必须显式放进 params,否则下面 OnlyFourColumns 永远拿不到值,
		// 全局/局部切换时日柱/时柱不会跳变(见用户拍板,baziLunarLocal.js + dayBoundary.js)。
		if(TransData.containsParam("after23NewDay")) {
			params.put("after23NewDay", TransData.get("after23NewDay"));
		}
		if(TransData.containsParam("lateZiHourUseNextDay")) {
			params.put("lateZiHourUseNextDay", TransData.get("lateZiHourUseNextDay"));
		}

		return params;
	}

	private int getSu28Mode() {
		if(!TransData.containsParam("doubingSu28")) {
			return 0;
		}
		Object raw = TransData.get("doubingSu28");
		if(raw instanceof Number) {
			return ((Number) raw).intValue();
		}
		if(raw instanceof Boolean) {
			return ((Boolean) raw) ? 1 : 0;
		}
		String val = ConvertUtility.getValueAsString(raw);
		if("true".equalsIgnoreCase(val)) {
			return 1;
		}
		if("false".equalsIgnoreCase(val)) {
			return 0;
		}
		return ConvertUtility.getValueAsInt(raw, 0);
	}
}
