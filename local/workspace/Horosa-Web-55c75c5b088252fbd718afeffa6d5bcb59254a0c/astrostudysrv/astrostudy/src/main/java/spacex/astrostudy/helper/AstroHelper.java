package spacex.astrostudy.helper;

import java.util.HashMap;
import java.util.Map;

import boundless.exception.ErrorCodeException;
import boundless.net.http.HttpClientUtility;
import boundless.spring.help.PropertyPlaceholder;
import boundless.utility.JsonUtility;

public class AstroHelper {
	private static final boolean Debug = PropertyPlaceholder.getPropertyAsBool("devmode", false);
	private static final boolean DisableRequestCache = PropertyPlaceholder.getPropertyAsBool("astrohelper.disable.request.cache", false);
	private static final int RequestCacheExpInSec = PropertyPlaceholder.getPropertyAsInt("astrohelper.request.cache.expireinsecond", 86400);

	// horosa_astrohelper_skip_inner_v1(PERF-R10 B7):外层已被 ParamHashCacheHelper 包裹的
	// 五个路径("/"=/chart、Chart13、Chart12、IndiaChart、JieQiYear),内层 request() 再包一次
	// = 同 scope 同参数 ⇒ **内外两层写同一个缓存文件**:冷路径多付一次 hash+persistable+同步
	// 文件写;更险的是 /chart13 等外层装配(补 nongli 等)后覆写同一文件 —— 装配 lambda 若在
	// 内层已写、外层未写之间抛异常,下一个请求会把未装配的 Python 原始响应当外层命中直接返回。
	// 桌面传 -Dastrohelper.skip.inner.cached.paths=true 让这五个路径的内层直通(响应字节不变:
	// 外层保存前有自己的 persistable() 归一)。保守枚举绝不通配:/jieqi/birth、/predict/* 等
	// 无外层包裹者,内层缓存是它们唯一的缓存,一个都不能跳。
	// 开关读取与 ParamHashCacheHelper.resolveBoolFlag 同源(先 -D 再属性文件;
	// PropertyPlaceholder 不读 -D,-- 程序参数只能覆盖已存在键 —— 判别铁律①)。
	private static boolean resolveBoolFlag(String key, boolean def) {
		String sys = System.getProperty(key);
		if(sys != null && sys.length() > 0) {
			return "true".equalsIgnoreCase(sys) || "1".equals(sys);
		}
		return PropertyPlaceholder.getPropertyAsBool(key, def);
	}
	private static final boolean SkipInnerForOuterWrapped = resolveBoolFlag("astrohelper.skip.inner.cached.paths", false);
	private static java.util.Set<String> OuterWrappedPaths = null;
	private static java.util.Set<String> outerWrappedPaths(){
		// 惰性:路径常量在本类更靠后的静态段初始化,惰性求值免去对字段文本顺序的依赖。
		if(OuterWrappedPaths == null){
			OuterWrappedPaths = new java.util.HashSet<String>(java.util.Arrays.asList(
				"/", Chart13, Chart12, IndiaChart, JieQiYear));
		}
		return OuterWrappedPaths;
	}

	public static final String AstroSrvUrl = PropertyPlaceholder.getProperty("astrosrv", "http://127.0.0.1:8899");
	public static final String SolarReturn = PropertyPlaceholder.getProperty("solarreturn", "/predict/solarreturn");
	public static final String LunarReturn = PropertyPlaceholder.getProperty("lunarreturn", "/predict/lunarreturn");
	public static final String GivenYear = PropertyPlaceholder.getProperty("givenyear", "/predict/givenyear");
	public static final String SolarArc = PropertyPlaceholder.getProperty("solararc", "/predict/solararc");
	public static final String PlanetaryArc = PropertyPlaceholder.getProperty("planetaryarc", "/predict/planetaryarc");
	public static final String PersianChart = PropertyPlaceholder.getProperty("persianchart", "/predict/persianchart");
	public static final String Distribution = PropertyPlaceholder.getProperty("dist", "/predict/dist");
	public static final String AgePoint = PropertyPlaceholder.getProperty("agepoint", "/predict/agepoint");
	public static final String Profection = PropertyPlaceholder.getProperty("profection", "/predict/profection");
	public static final String PrimaryDirection = PropertyPlaceholder.getProperty("pd", "/predict/pd");
	public static final String PrimaryDirectionChart = PropertyPlaceholder.getProperty("pdchart", "/predict/pdchart");
	public static final String ZodiacalRelease = PropertyPlaceholder.getProperty("zr", "/predict/zr");
	public static final String Dice = PropertyPlaceholder.getProperty("dice", "/predict/dice");
	public static final String Chart13 = PropertyPlaceholder.getProperty("chart13", "/chart13");
	public static final String Chart12 = PropertyPlaceholder.getProperty("chart12", "/chart12");
	public static final String IndiaChart = PropertyPlaceholder.getProperty("indiachart", "/india/chart");
	public static final String RelativeChart = PropertyPlaceholder.getProperty("relativechart", "/modern/relative");
	public static final String MidPoint = PropertyPlaceholder.getProperty("midpoint", "/germany/midpoint");
	public static final String JieQiYear = PropertyPlaceholder.getProperty("jieqiyear", "/jieqi/year");
	public static final String JieQiBirth = PropertyPlaceholder.getProperty("jieqibirth", "/jieqi/birth");
	public static final String Nongli = PropertyPlaceholder.getProperty("nongli", "/jieqi/nongli");
	public static final String JdnDate = PropertyPlaceholder.getProperty("jdndate", "/jdn/date");
	public static final String Acg = PropertyPlaceholder.getProperty("acg", "/location/acg");
	public static final String AcgPoint = PropertyPlaceholder.getProperty("acgpoint", "/location/acgpoint");
	public static final String AcgEvent = PropertyPlaceholder.getProperty("acgevent", "/location/acgevent");
	public static final String Azimuth = PropertyPlaceholder.getProperty("azimuth", "/calc/azimuth");
	public static final String Cotrans = PropertyPlaceholder.getProperty("cotrans", "/calc/cotrans");
	public static final String AstroExtraAnalysis = PropertyPlaceholder.getProperty("astroextra.analysis", "/astroextra/analysis");
	public static final String AstroExtraPrenatalSyzygy = PropertyPlaceholder.getProperty("astroextra.prenatal_syzygy", "/astroextra/prenatal_syzygy");
	public static final String AstroExtraEphemeris = PropertyPlaceholder.getProperty("astroextra.ephemeris", "/astroextra/ephemeris");
	public static final String AstroExtraProgressions = PropertyPlaceholder.getProperty("astroextra.progressions", "/astroextra/progressions");
	public static final String AstroExtraJaynesProg = PropertyPlaceholder.getProperty("astroextra.jaynesprog", "/astroextra/jaynesprog");
	public static final String AstroExtraReturns = PropertyPlaceholder.getProperty("astroextra.returns", "/astroextra/returns");
	public static final String AstroExtraHarmonic = PropertyPlaceholder.getProperty("astroextra.harmonic", "/astroextra/harmonic");
	public static final String AstroExtraDraconic = PropertyPlaceholder.getProperty("astroextra.draconic", "/astroextra/draconic");
	public static final String AstroExtraRelocation = PropertyPlaceholder.getProperty("astroextra.relocation", "/astroextra/relocation");
	public static final String AstroExtraGreatConj = PropertyPlaceholder.getProperty("astroextra.greatconj", "/astroextra/greatconj");
	public static final String AstroExtraPlanetCycles = PropertyPlaceholder.getProperty("astroextra.planetcycles", "/astroextra/planetcycles");
	public static final String AstroExtraBarbault = PropertyPlaceholder.getProperty("astroextra.barbault", "/astroextra/barbault");
	public static final String AstroExtraPlanetReturn = PropertyPlaceholder.getProperty("astroextra.planetreturn", "/astroextra/planetreturn");
	public static final String AstroExtraEclipseDetail = PropertyPlaceholder.getProperty("astroextra.eclipsedetail", "/astroextra/eclipsedetail");
	public static final String AstroExtraRelative = PropertyPlaceholder.getProperty("astroextra.relative", "/astroextra/relative");
	public static final String PlanetariumState = PropertyPlaceholder.getProperty("planetarium.state", "/planetarium/state");
	public static final String Chart3DState = PropertyPlaceholder.getProperty("chart3d.state", "/chart3d/state");
	public static final String PrimaryDirection3D = PropertyPlaceholder.getProperty("pd3d", "/predict/pd3d");
	
	private static Map<String, Object> request(String path, Map<String, Object> params){
		if(Debug || DisableRequestCache) {
			return requestNoCache(path, params);
		}
		if(SkipInnerForOuterWrapped && outerWrappedPaths().contains(path)) {
			// horosa_astrohelper_skip_inner_v1:外层 Controller 已包 ParamHashCacheHelper,
			// 内层直通 —— 见类头注释(撞键隐患 + 冷路径双写)。
			return requestNoCache(path, params);
		}
		Object obj = ParamHashCacheHelper.get(path, params, (args)->{
			return requestNoCache(path, args);
		}, RequestCacheExpInSec);
		return (Map<String, Object>)obj;
	}
	
	public static Map<String, Object> requestNoCache(String path, Map<String, Object> params){
		String url = String.format("%s%s", AstroSrvUrl, path);
		String jsonData = JsonUtility.encode(params);
		Map<String, String> headers = new HashMap<String, String>();
		Map<String, String> respHeadMap = new HashMap<String, String>();
		String str = HttpClientUtility.uploadString(url, headers, "application/json; charset=UTF-8", jsonData, respHeadMap);
		Map<String, Object> jsonres = JsonUtility.toDictionary(str);
		if(jsonres.containsKey("err")) {
			throw new ErrorCodeException(200001, jsonres.get("err").toString());
		}
		
		return jsonres;		
	}
	
	
	public static Map<String, Object> getChart(Map<String, Object> params) {
		return request("/", params);
	}
	
	public static Map<String, Object> getSolarReturn(Map<String, Object> params){
		return request(SolarReturn, params);
	}
	
	public static Map<String, Object> getLunarReturn(Map<String, Object> params){
		return request(LunarReturn, params);
	}
	
	public static Map<String, Object> getGivenYear(Map<String, Object> params){
		return request(GivenYear, params);
	}
	
	public static Map<String, Object> getSolarArc(Map<String, Object> params){
		return request(SolarArc, params);
	}

	public static Map<String, Object> getPlanetaryArc(Map<String, Object> params){
		return request(PlanetaryArc, params);
	}

	public static Map<String, Object> getPersianChart(Map<String, Object> params){
		return request(PersianChart, params);
	}
	
	public static Map<String, Object> getProfection(Map<String, Object> params){
		return request(Profection, params);
	}

	public static Map<String, Object> getDistribution(Map<String, Object> params){
		return request(Distribution, params);
	}

	public static Map<String, Object> getAgePoint(Map<String, Object> params){
		return request(AgePoint, params);
	}
	
	public static Map<String, Object> getPrimaryDirection(Map<String, Object> params){
		return request(PrimaryDirection, params);
	}

	public static Map<String, Object> getPrimaryDirectionChart(Map<String, Object> params){
		return request(PrimaryDirectionChart, params);
	}
	
	public static Map<String, Object> getZodiacalRelease(Map<String, Object> params){
		return request(ZodiacalRelease, params);
	}
	
	public static Map<String, Object> getChart13(Map<String, Object> params){
		return request(Chart13, params);
	}

	public static Map<String, Object> getChart12(Map<String, Object> params){
		return request(Chart12, params);
	}
	
	public static Map<String, Object> getIndiaChart(Map<String, Object> params){
		return request(IndiaChart, params);
	}

	
	public static Map<String, Object> getRelativeChart(Map<String, Object> params){
		return request(RelativeChart, params);
	}
	
	public static Map<String, Object> getGermanyTech(Map<String, Object> params){
		return request(MidPoint, params);
	}
	
	public static Map<String, Object> getJieQiYear(Map<String, Object> params){
		return request(JieQiYear, params);
	}
	
	public static Map<String, Object> getJieQiBirth(Map<String, Object> params){
		return request(JieQiBirth, params);
	}
	
	public static Map<String, Object> getNongliMonth(Map<String, Object> params){
		return request(Nongli, params);
	}
	
	public static String getJdnDate(Map<String, Object> params){
		Map<String, Object> res = requestNoCache(JdnDate, params);
		return (String) res.get("date");
	}
	
	public static Map<String, Object> getAcg(Map<String, Object> params){
		// 参数全显式且结果确定(星历不随日内时间变),纳入 paramhash 缓存:同参二次 ~300ms→~5ms
		return request(Acg, params);
	}

	public static Map<String, Object> getAcgPoint(Map<String, Object> params){
		return request(AcgPoint, params);
	}

	public static Map<String, Object> getAcgEvent(Map<String, Object> params){
		return requestNoCache(AcgEvent, params);
	}
	
	public static Map<String, Object> getDice(Map<String, Object> params){
		return requestNoCache(Dice, params);
	}
	
	public static Map<String, Object> getAzimuth(Map<String, Object> params){
		return requestNoCache(Azimuth, params);
	}
	
	public static Map<String, Object> getCotrans(Map<String, Object> params){
		return requestNoCache(Cotrans, params);
	}

	public static Map<String, Object> getAstroExtraAnalysis(Map<String, Object> params){
		return request(AstroExtraAnalysis, params);
	}

	public static Map<String, Object> getAstroExtraPrenatalSyzygy(Map<String, Object> params){
		return request(AstroExtraPrenatalSyzygy, params);
	}

	public static Map<String, Object> getAstroExtraEphemeris(Map<String, Object> params){
		return request(AstroExtraEphemeris, params);
	}

	public static Map<String, Object> getAstroExtraProgressions(Map<String, Object> params){
		return request(AstroExtraProgressions, params);
	}

	public static Map<String, Object> getAstroExtraJaynesProg(Map<String, Object> params){
		return request(AstroExtraJaynesProg, params);
	}

	public static Map<String, Object> getAstroExtraReturns(Map<String, Object> params){
		return request(AstroExtraReturns, params);
	}

	public static Map<String, Object> getAstroExtraHarmonic(Map<String, Object> params){
		return request(AstroExtraHarmonic, params);
	}

	public static Map<String, Object> getAstroExtraRelocation(Map<String, Object> params){
		return request(AstroExtraRelocation, params);
	}

	public static Map<String, Object> getAstroExtraDraconic(Map<String, Object> params){
		return request(AstroExtraDraconic, params);
	}

	public static Map<String, Object> getAstroExtraGreatConj(Map<String, Object> params){
		return request(AstroExtraGreatConj, params);
	}

	public static Map<String, Object> getAstroExtraPlanetCycles(Map<String, Object> params){
		return request(AstroExtraPlanetCycles, params);
	}

	public static Map<String, Object> getAstroExtraBarbault(Map<String, Object> params){
		return request(AstroExtraBarbault, params);
	}

	public static Map<String, Object> getAstroExtraPlanetReturn(Map<String, Object> params){
		return request(AstroExtraPlanetReturn, params);
	}

	public static Map<String, Object> getAstroExtraEclipseDetail(Map<String, Object> params){
		return request(AstroExtraEclipseDetail, params);
	}

	public static Map<String, Object> getAstroExtraRelative(Map<String, Object> params){
		return request(AstroExtraRelative, params);
	}

	public static Map<String, Object> getPlanetariumState(Map<String, Object> params){
		return requestNoCache(PlanetariumState, params);
	}

	public static Map<String, Object> getChart3DState(Map<String, Object> params){
		// 与 Planetarium 相同机制:免 paramhash 缓存直连 Python(3D 视图交互态频繁变参,缓存收益低)
		return requestNoCache(Chart3DState, params);
	}

	public static Map<String, Object> getPrimaryDirection3D(Map<String, Object> params){
		// 照 /pd /pdchart 形态:参数全显式且结果确定,走 paramhash 缓存
		return request(PrimaryDirection3D, params);
	}

	}
