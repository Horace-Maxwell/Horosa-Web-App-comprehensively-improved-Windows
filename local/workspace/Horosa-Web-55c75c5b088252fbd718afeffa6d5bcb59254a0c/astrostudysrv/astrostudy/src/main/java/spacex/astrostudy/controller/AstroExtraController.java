package spacex.astrostudy.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import spacex.astrostudy.helper.AstroHelper;

@Controller
@RequestMapping("/astroextra")
public class AstroExtraController {
	private static final String[] OPTIONAL_KEYS = new String[] {
		"ad", "gpsLat", "gpsLon", "southchart", "strongRecption", "virtualPointReceiveAsp",
		"simpleAsp", "predictive", "tradition", "zodiacal", "fixedStarOrb", "startDate",
		"endDate", "startTime", "endTime", "includeTransits", "planets", "natalPoints",
		"aspects", "targetDate", "targetTime", "datetime", "orb", "startYear", "endYear", "count",
		"harmonic", "inner", "outer", "relative", "altitude", "body", "p1", "p2", "aspect", "eclipseKind",
		"minorVariant", "relocLat", "relocLon", "termsVariant", "voidClassical",
		// 变换盘(种类 / 基准星 / 宫位同转 / 对应宫头)与黄道制版本:漏登记会被白名单静默丢弃,页面永远停在缺省变换。
		"transformKind", "transformPlanet", "transformShift", "transformHouse", "transformVariant", "zodiacVersion",
		// 诸方:人类图交点(真 / 平)与灵名象限
		"hdTrueNode", "spiritQuadrant",
		// 自定义容许度:前端 AstroExtraCommon 早已把 orbs/orbScale 放进请求体,
		// 此处缺键 → 调波盘 / 龙盘 / 重置盘的相位恒按默认容许度(ChartController、
		// PredictiveController 均已转发,只有本族断)。缺省不发 = 零回归。
		"orbs", "orbScale",
		// 龙盘宫位口径(whole 整宫缺省 / shift 本命宫头随交点平移):缺键 = 整宫 = 零回归;漏登记会被静默丢弃(白名单)。
		"draconicHouses",
		// 食时刻口径(星历页食相表:'max' 食甚=现状默认/'syzygy' 精确朔望)。
		"eclipseTimeMode",
		// 古典设置全集透传:前端 chartParams 经 natalClassicalParams 早已全带,
		// 此前本白名单逐个丢键 → analysis 族(Almuten/逐题主星/行星时/气质/埃及历)对全部
		// 古典档位空转(右栏改档恒旧值)。与 classicalParamSpec send:'nonDefault' 全集
		// lockstep(backendKey 口径:fixedStarOrb→starOrb/fixedStarOrbMode→starOrbMode);
		// 合同 classicalSurfaceParity.test.js 机械看守,缺键即红。
		"geminiBoundEmended", "leoBoundFirst", "triplicity", "dignityDebilities",
		"almutenTripMode", "planetaryHourMethod", "sectBuffer", "sunriseMode", "westNodeType",
		"nodeExaltation", "cazimiOrb", "combustOrb", "combustOwnChariotExempt",
		"underBeamsOrb", "vocMode", "vocIncludeOuter", "westLilithType", "topocentricMoon",
		"viaCombustaVariant", "lotReversal", "lotsDocReverse", "hermeticLotsReversal",
		"erosConstruction", "lotFortuneVariant", "lotFatherCombustAlt", "lotProjection",
		"orbSystem", "luminaryOrbBonus", "aspectIncludeCusps", "aspectIncludeLots",
		"aspectIncludeMidpoints", "antisciaOrb", "starOrb", "starOrbMode", "stationMarking",
		"solarReturnVariant", "returnLatitudeMode", "houseCuspAdvance", "vulcanCalc",
		"customTermsDay", "customTermsNight", "siderealAyanamsa", "userAyanT0", "userAyanDeg",
		// 推运图族(演进推运 / 推运图 / 周日小限 / 双黄道)的专属设置;缺省不发 = 引擎缺省。
		"nerK", "nerT0", "nerKeepDec", "maxAge", "jayFrom", "mzSwap", "mzEqual",
		// 印占过运穿界表
		"transitStart", "transitDays", "transitPlanet", "transitKind",
		// 时主轮转的专属设置
		"method", "yearType", "turnStart", "turnOrder", "orbMode", "annualDays", "annualOrder", "releaser", "variant",
		"nineTime", "nineReverse", "rateKind", "movingStart", "devBasis", "diurnalMode", "detailFaces", "table", "conjKind", "meanTable", "flood", "cycleYear", "firdariaLevel", "firdariaYears", "profRate", "profBase", "dawrStart", "eraKind", "ingressPoint",
		// 盘面细节续表
		"lunarMethod", "mundoSystem", "midpointCoord",
		// 世俗主限的时间键、气象占的月数
		"mpdKey", "weatherMonths"
	};

	private Map<String, Object> getBaseParams(){
		Map<String, Object> params = new HashMap<String, Object>();
		if(!TransData.containsParam("date")) {
			throw new ErrorCodeException(390001, "miss.date");
		}
		if(!TransData.containsParam("time")) {
			throw new ErrorCodeException(390002, "miss.time");
		}
		if(!TransData.containsParam("zone")) {
			throw new ErrorCodeException(390003, "miss.zone");
		}
		if(!TransData.containsParam("lat")) {
			throw new ErrorCodeException(390004, "miss.lat");
		}
		if(!TransData.containsParam("lon")) {
			throw new ErrorCodeException(390005, "miss.lon");
		}
		params.put("date", TransData.get("date"));
		params.put("time", TransData.get("time"));
		params.put("zone", TransData.get("zone"));
		params.put("lat", TransData.get("lat"));
		params.put("lon", TransData.get("lon"));
		params.put("hsys", TransData.getValueAsInt("hsys", 0));
		for(String key: OPTIONAL_KEYS) {
			if(TransData.containsParam(key)) {
				params.put(key, TransData.get(key));
			}
		}
		return params;
	}

	private Map<String, Object> getGreatConjParams(){
		Map<String, Object> params = new HashMap<String, Object>();
		params.put("startYear", TransData.getValueAsInt("startYear", 1900));
		params.put("endYear", TransData.getValueAsInt("endYear", 2100));
		return params;
	}

	private Map<String, Object> getPlanetCyclesParams(){
		Map<String, Object> params = new HashMap<String, Object>();
		params.put("startYear", TransData.getValueAsInt("startYear", 1900));
		params.put("endYear", TransData.getValueAsInt("endYear", 2100));
		if(TransData.containsParam("p1")) { params.put("p1", TransData.get("p1")); }
		if(TransData.containsParam("p2")) { params.put("p2", TransData.get("p2")); }
		if(TransData.containsParam("aspect")) { params.put("aspect", TransData.get("aspect")); }
		// 世运行星周期 地心/日心 视角(Python compute_planet_cycles 已支持;缺此白名单=前端传了也静默丢)
		if(TransData.containsParam("center")) { params.put("center", TransData.get("center")); }
		return params;
	}

	private Map<String, Object> getBarbaultParams(){
		Map<String, Object> params = new HashMap<String, Object>();
		params.put("startYear", TransData.getValueAsInt("startYear", 1900));
		params.put("endYear", TransData.getValueAsInt("endYear", 2050));
		if(TransData.containsParam("stepMonths")) { params.put("stepMonths", TransData.get("stepMonths")); }
		if(TransData.containsParam("planets")) { params.put("planets", TransData.get("planets")); }
		if(TransData.containsParam("center")) { params.put("center", TransData.get("center")); }
		if(TransData.containsParam("harm")) { params.put("harm", TransData.get("harm")); }
		return params;
	}

	private Map<String, Object> getRelativeParams(){
		Map<String, Object> params = new HashMap<String, Object>();
		if(!TransData.containsParam("inner")) {
			throw new ErrorCodeException(391001, "miss.inner");
		}
		if(!TransData.containsParam("outer")) {
			throw new ErrorCodeException(391002, "miss.outer");
		}
		params.put("inner", TransData.get("inner"));
		params.put("outer", TransData.get("outer"));
		params.put("hsys", TransData.getValueAsInt("hsys", 0));
		params.put("zodiacal", TransData.getValueAsInt("zodiacal", 0));
		if(TransData.containsParam("siderealAyanamsa")) {
			params.put("siderealAyanamsa", TransData.get("siderealAyanamsa"));
		}
		if(TransData.containsParam("relative")) {
			params.put("relative", TransData.get("relative"));
		}
		// 容许度(逐星表 / 整体倍率):比较盘那条链路早已放行;这里不放行的话,关系量化仍按固定 1° 判跨盘接触,
		// 与同一对盘的比较盘(随倍率放缩)对不上
		if(TransData.containsParam("orbs")) {
			params.put("orbs", TransData.get("orbs"));
		}
		if(TransData.containsParam("orbScale")) {
			params.put("orbScale", TransData.get("orbScale"));
		}
		return params;
	}

	@ResponseBody
	@RequestMapping("/analysis")
	public void analysis(){
		TransData.set(AstroHelper.getAstroExtraAnalysis(getBaseParams()));
	}

	@ResponseBody
	@RequestMapping("/prenatal_syzygy")
	public void prenatalSyzygy(){
		TransData.set(AstroHelper.getAstroExtraPrenatalSyzygy(getBaseParams()));
	}

	@ResponseBody
	@RequestMapping("/ephemeris")
	public void ephemeris(){
		TransData.set(AstroHelper.getAstroExtraEphemeris(getBaseParams()));
	}

	@ResponseBody
	@RequestMapping("/progressions")
	public void progressions(){
		TransData.set(AstroHelper.getAstroExtraProgressions(getBaseParams()));
	}

	@ResponseBody
	@RequestMapping("/jaynesprog")
	public void jaynesprog(){
		TransData.set(AstroHelper.getAstroExtraJaynesProg(getBaseParams()));
	}

	@ResponseBody
	@RequestMapping("/neroman")
	public void neroman(){
		TransData.set(AstroHelper.getAstroExtraNeroman(getBaseParams()));
	}

	@ResponseBody
	@RequestMapping("/bezzafigure")
	public void bezzafigure(){
		TransData.set(AstroHelper.getAstroExtraBezzaFigure(getBaseParams()));
	}

	@ResponseBody
	@RequestMapping("/jayprofection")
	public void jayprofection(){
		TransData.set(AstroHelper.getAstroExtraJayProfection(getBaseParams()));
	}

	@ResponseBody
	@RequestMapping("/michon")
	public void michon(){
		TransData.set(AstroHelper.getAstroExtraMichon(getBaseParams()));
	}

	@ResponseBody
	@RequestMapping("/timelords")
	public void timelords(){
		TransData.set(AstroHelper.getAstroExtraTimeLords(getBaseParams()));
	}

	@ResponseBody
	@RequestMapping("/chartdetails")
	public void chartdetails(){
		TransData.set(AstroHelper.getAstroExtraChartDetails(getBaseParams()));
	}

	@ResponseBody
	@RequestMapping("/transformchart")
	public void transformchart(){
		TransData.set(AstroHelper.getAstroExtraTransformChart(getBaseParams()));
	}

	@ResponseBody
	@RequestMapping("/zodiacsystems")
	public void zodiacsystems(){
		TransData.set(AstroHelper.getAstroExtraZodiacSystems(getBaseParams()));
	}

	@ResponseBody
	@RequestMapping("/zhufang")
	public void zhufang(){
		TransData.set(AstroHelper.getAstroExtraZhufang(getBaseParams()));
	}

	@ResponseBody
	@RequestMapping("/babylontables")
	public void babylontables(){
		TransData.set(AstroHelper.getAstroExtraBabylonTables(getBaseParams()));
	}

	@ResponseBody
	@RequestMapping("/mundanecycles")
	public void mundanecycles(){
		TransData.set(AstroHelper.getAstroExtraMundaneCycles(getBaseParams()));
	}

	@ResponseBody
	@RequestMapping("/returns")
	public void returns(){
		TransData.set(AstroHelper.getAstroExtraReturns(getBaseParams()));
	}

	@ResponseBody
	@RequestMapping("/harmonic")
	public void harmonic(){
		TransData.set(AstroHelper.getAstroExtraHarmonic(getBaseParams()));
	}

	@ResponseBody
	@RequestMapping("/draconic")
	public void draconic(){
		TransData.set(AstroHelper.getAstroExtraDraconic(getBaseParams()));
	}

	@ResponseBody
	@RequestMapping("/relocation")
	public void relocation(){
		TransData.set(AstroHelper.getAstroExtraRelocation(getBaseParams()));
	}

	@ResponseBody
	@RequestMapping("/greatconj")
	public void greatconj(){
		TransData.set(AstroHelper.getAstroExtraGreatConj(getGreatConjParams()));
	}

	@ResponseBody
	@RequestMapping("/planetcycles")
	public void planetcycles(){
		TransData.set(AstroHelper.getAstroExtraPlanetCycles(getPlanetCyclesParams()));
	}

	@ResponseBody
	@RequestMapping("/barbault")
	public void barbault(){
		TransData.set(AstroHelper.getAstroExtraBarbault(getBarbaultParams()));
	}

	@ResponseBody
	@RequestMapping("/planetreturn")
	public void planetreturn(){
		TransData.set(AstroHelper.getAstroExtraPlanetReturn(getBaseParams()));
	}

	@ResponseBody
	@RequestMapping("/eclipsedetail")
	public void eclipsedetail(){
		TransData.set(AstroHelper.getAstroExtraEclipseDetail(getBaseParams()));
	}

	@ResponseBody
	@RequestMapping("/relative")
	public void relative(){
		TransData.set(AstroHelper.getAstroExtraRelative(getRelativeParams()));
	}

	@ResponseBody
	@RequestMapping("/transitevents")
	public void transitevents(){
		TransData.set(AstroHelper.getAstroExtraTransitEvents(getBaseParams()));
	}

	@ResponseBody
	@RequestMapping("/ashtakoota")
	public void ashtakoota(){
		Map<String, Object> params = getRelativeParams();
		if(TransData.containsParam("maleSide")) {
			params.put("maleSide", TransData.get("maleSide"));
		}
		TransData.set(AstroHelper.getAstroExtraAshtakoota(params));
	}
}
