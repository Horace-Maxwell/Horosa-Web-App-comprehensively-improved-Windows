package spacex.astrostudy.controller;


import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.JsonUtility;
import spacex.astrostudy.helper.AstroHelper;
import spacex.astrostudy.helper.ParamHashCacheHelper;

@Controller
@RequestMapping("/india")
public class IndiaChartController {

	@ResponseBody
	@RequestMapping("/chart")
	public void chart(){
		Map<String, Object> params = getParams();
		Map<String, Object> keyparams = new HashMap<String, Object>();
		keyparams.putAll(params);
		keyparams.remove("gpsLat");
		keyparams.remove("gpsLon");
		Object obj = ParamHashCacheHelper.get("/india/chart", keyparams, (args)->{
			Map<String, Object> res = AstroHelper.getIndiaChart(args);
			return res;
		});

		Map<String, Object> res = (Map<String, Object>)obj;
		Map<String, Object> reqparams = (Map<String, Object>) res.get("params");
		if(reqparams != null) {
			reqparams.put("gpsLat", TransData.get("gpsLat"));
			reqparams.put("gpsLon", TransData.get("gpsLon"));	
		}
		
		TransData.set(res);
	}
	

	// 出生时间校正:独立端点、直透 Python,不走 ParamHashCacheHelper(扫描参数进命盘缓存键
	// 会导致「改一次步长炸掉全部命盘缓存」;且校时结果按窗口即时算,不宜缓存)。
	@ResponseBody
	@RequestMapping("/rectify")
	public void rectify(){
		Map<String, Object> params = getParams();
		if(TransData.containsParam("rectifyWindowMinutes")) {
			params.put("rectifyWindowMinutes", TransData.get("rectifyWindowMinutes"));
		}
		if(TransData.containsParam("rectifyStepSeconds")) {
			params.put("rectifyStepSeconds", TransData.get("rectifyStepSeconds"));
		}
		if(TransData.containsParam("rectifyRpSource")) {
			params.put("rectifyRpSource", TransData.get("rectifyRpSource"));
		}
		if(TransData.containsParam("rectifyCustomRp")) {
			params.put("rectifyCustomRp", TransData.get("rectifyCustomRp"));
		}
		if(TransData.containsParam("rectifyTopK")) {
			params.put("rectifyTopK", TransData.getValueAsInt("rectifyTopK", 3));
		}
		if(TransData.containsParam("rectifyEvents")) {
			Object evobj = TransData.get("rectifyEvents");
			if(evobj instanceof String) {
				evobj = JsonUtility.decodeList((String)evobj, Map.class);
			}
			params.put("rectifyEvents", evobj);
		}
		Map<String, Object> res = AstroHelper.getIndiaRectify(params);
		TransData.set(res);
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
		params.put("_wireRev", spacex.basecomm.constants.PdWire.REV);
		params.put("_indiaOptionsRev", "india_kernel_yoga_v1");
		if(TransData.containsParam("_jyotishRev")) {
			params.put("_jyotishRev", TransData.getValueAsString("_jyotishRev"));
		}
		params.put("hsys", TransData.getValueAsInt("indiaHsys", TransData.getValueAsInt("hsys", 0)));
		params.put("indiaHsys", TransData.getValueAsInt("indiaHsys", TransData.getValueAsInt("hsys", 0)));
		String indiaAyanamsa = "lahiri";
		if(TransData.containsParam("indiaAyanamsa")) {
			indiaAyanamsa = TransData.getValueAsString("indiaAyanamsa");
		}else if(TransData.containsParam("ayanamsa")) {
			indiaAyanamsa = TransData.getValueAsString("ayanamsa");
		}else if(TransData.containsParam("siderealMode")) {
			indiaAyanamsa = TransData.getValueAsString("siderealMode");
		}
		params.put("indiaAyanamsa", indiaAyanamsa);
		params.put("ayanamsa", indiaAyanamsa);
		params.put("siderealMode", indiaAyanamsa);
		// 罗睺/计都交点口径:'mean'(平交点,默认)或 'true'(真交点)。白名单未登记会被静默丢弃。
		String nodeType = "mean";
		if(TransData.containsParam("nodeType")) {
			nodeType = TransData.getValueAsString("nodeType");
		} else if(TransData.containsParam("indiaNodeType")) {
			nodeType = TransData.getValueAsString("indiaNodeType");
		}
		params.put("nodeType", nodeType);
		params.put("tradition", TransData.getValueAsBool("tradition", false));
		params.put("strongRecption", TransData.getValueAsBool("strongRecption", false));
		params.put("virtualPointReceiveAsp", TransData.getValueAsBool("virtualPointReceiveAsp", false));
		params.put("simpleAsp", TransData.getValueAsBool("simpleAsp", false));
		params.put("predictive", TransData.getValueAsBool("predictive", false));
		params.put("includePrimaryDirection", TransData.getValueAsBool("includePrimaryDirection", false));
		params.put("southchart", TransData.getValueAsBool("southchart", false));
		params.put("zodiacal", 1);
		params.put("chartnum", TransData.getValueAsInt("chartnum", 0));
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
		// 印度功能扩展可选参数(白名单未登记会被静默丢弃)：
		//   vargaSet 多分盘集 / transitDate 过运日期 / tajakaYear+tajakaApprox 年度盘 / dashaSystem 大运派别。
		//   均可选、仅前端下发时透传，缺省不进 cache key → 既有请求零缓存影响。
		if(TransData.containsParam("vargaSet")) {
			params.put("vargaSet", TransData.get("vargaSet"));
		}
		if(TransData.containsParam("transitDate")) {
			params.put("transitDate", TransData.get("transitDate"));
		}
		if(TransData.containsParam("tajakaYear")) {
			params.put("tajakaYear", TransData.getValueAsInt("tajakaYear", 0));
		}
		if(TransData.containsParam("tajakaApprox")) {
			params.put("tajakaApprox", TransData.getValueAsBool("tajakaApprox", false));
		}
		if(TransData.containsParam("dashaSystem")) {
			params.put("dashaSystem", TransData.get("dashaSystem"));
		}
		if(TransData.containsParam("dashaSeed")) {
			params.put("dashaSeed", TransData.get("dashaSeed"));
		}
		if(TransData.containsParam("sthiraStart")) {
			params.put("sthiraStart", TransData.get("sthiraStart"));
		}
		// KP 补齐(2026-07-21):年长/年盘口径/三旗/问事族。白名单未登记会被静默丢弃(三层丢参坑),
		// 全为可选键:仅前端显式下发时透传,缺省不进 cache key → 既有请求零缓存影响。
		if(TransData.containsParam("dashaYearLength")) {
			params.put("dashaYearLength", TransData.get("dashaYearLength"));
		}
		// 分盘变体({chartnum:variant} JSON 串)/Chara Karaka 方案(7|8)/星曜战判据(latitude|longitude)。
		if(TransData.containsParam("vargaVariant")) {
			params.put("vargaVariant", TransData.get("vargaVariant"));
		}
		if(TransData.containsParam("karakaScheme")) {
			params.put("karakaScheme", TransData.get("karakaScheme"));
		}
		if(TransData.containsParam("yuddhaCriterion")) {
			params.put("yuddhaCriterion", TransData.get("yuddhaCriterion"));
		}
		if(TransData.containsParam("dashaVariants")) {
			params.put("dashaVariants", TransData.get("dashaVariants"));
		}
		if(TransData.containsParam("varshaLat")) {
			params.put("varshaLat", TransData.get("varshaLat"));
		}
		if(TransData.containsParam("varshaLon")) {
			params.put("varshaLon", TransData.get("varshaLon"));
		}
		if(TransData.containsParam("annualChartType")) {
			params.put("annualChartType", TransData.get("annualChartType"));
		}
		if(TransData.containsParam("tripataki")) {
			params.put("tripataki", TransData.get("tripataki"));
		}
		if(TransData.containsParam("prashnaTime")) {
			params.put("prashnaTime", TransData.get("prashnaTime"));
			if(TransData.containsParam("prashnaNumber")) {
				params.put("prashnaNumber", TransData.getValueAsInt("prashnaNumber", 0));
			}
			if(TransData.containsParam("prashnaMatter")) {
				params.put("prashnaMatter", TransData.get("prashnaMatter"));
			}
			if(TransData.containsParam("prashnaSchools")) {
				params.put("prashnaSchools", TransData.get("prashnaSchools"));
			}
			if(TransData.containsParam("prashnaCuspMode")) {
				params.put("prashnaCuspMode", TransData.get("prashnaCuspMode"));
			}
			if(TransData.containsParam("prashnaPrimaryHouse")) {
				params.put("prashnaPrimaryHouse", TransData.getValueAsInt("prashnaPrimaryHouse", 0));
			}
		}
		if(TransData.containsParam("gpsLat")) {
			params.put("gpsLat", TransData.get("gpsLat"));
			params.put("gpsLon", TransData.get("gpsLon"));
		}
		
		return params;
	}
}
