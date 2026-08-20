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
		// [WP-2] 食时刻口径(星历页食相表:'max' 食甚=现状默认/'syzygy' 精确朔望)。
		"eclipseTimeMode",
		// [SURF-1] 古典设置全集透传:前端 chartParams 经 natalClassicalParams 早已全带,
		// 此前本白名单逐个丢键 → analysis 族(Almuten/逐题主星/行星时/气质/埃及历)对全部
		// 古典档位空转(右栏改档恒旧值)。与 classicalParamSpec send:'nonDefault' 全集
		// lockstep(backendKey 口径:fixedStarOrb→starOrb/fixedStarOrbMode→starOrbMode);
		// 合同 classicalSurfaceParity.test.js 机械看守,缺键即红。
		"geminiBoundEmended", "leoBoundFirst", "triplicity", "dignityDebilities",
		"almutenTripMode", "planetaryHourMethod", "sectBuffer", "westNodeType",
		"nodeExaltation", "cazimiOrb", "combustOrb", "combustOwnChariotExempt",
		"underBeamsOrb", "vocMode", "vocIncludeOuter", "westLilithType", "topocentricMoon",
		"viaCombustaVariant", "lotReversal", "lotsDocReverse", "hermeticLotsReversal",
		"erosConstruction", "lotFortuneVariant", "lotFatherCombustAlt", "lotProjection",
		"orbSystem", "luminaryOrbBonus", "aspectIncludeCusps", "aspectIncludeLots",
		"aspectIncludeMidpoints", "antisciaOrb", "starOrb", "starOrbMode", "stationMarking",
		"solarReturnVariant", "returnLatitudeMode", "houseCuspAdvance", "vulcanCalc",
		"customTermsDay", "customTermsNight", "siderealAyanamsa", "userAyanT0", "userAyanDeg"
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
}
