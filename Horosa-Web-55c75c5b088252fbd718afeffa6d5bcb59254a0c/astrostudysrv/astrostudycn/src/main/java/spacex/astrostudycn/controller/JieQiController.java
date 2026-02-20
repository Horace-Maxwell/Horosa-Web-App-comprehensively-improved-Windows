package spacex.astrostudycn.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.ConvertUtility;
import spacex.astrostudy.constants.PhaseType;
import spacex.astrostudy.helper.AstroHelper;
import spacex.astrostudy.helper.CacheHelper;
import spacex.astrostudy.model.godrule.GodRule;
import spacex.astrostudycn.constants.TimeZiAlg;
import spacex.astrostudycn.model.BaZi;
import spacex.astrostudycn.model.OnlyFourColumns;

@Controller
@RequestMapping("/jieqi")
public class JieQiController {

	@ResponseBody
	@RequestMapping("/year")
	public void year(){
		Map<String, Object> params = getYearParams();
		int ad = ConvertUtility.getValueAsInt(params.get("ad"), 1);
		
		Map<String, Object> keyparams = new HashMap<String, Object>();
		keyparams.putAll(params);
		keyparams.remove("gpsLat");
		keyparams.remove("gpsLon");
		Object obj = CacheHelper.get("/jieqi/year", keyparams, (args)->{
			Map<String, Object> res = AstroHelper.getJieQiYear(params);
			setupBazi(res, params);
			Map<String, Object> reqparams = (Map<String, Object>) res.get("params");
			if(reqparams != null) {
				reqparams.put("gpsLat", TransData.get("gpsLat"));
				reqparams.put("gpsLon", TransData.get("gpsLon"));	
			}
			Map<String, Map<String, Object>> charts = (Map<String, Map<String, Object>>) res.get("charts");
			for(Map<String, Object> val : charts.values()) {
				Map<String, Object> chart = (Map<String, Object>) val.get("chart");
				Map<String, Object> chartparams = (Map<String, Object>) val.get("params");
				String tm = (String) chartparams.get("birth");
				String zone = (String) chartparams.get("zone");
				String lat = (String) chartparams.get("lat");
				String lon = (String) chartparams.get("lon");
				boolean after23NewDay = false;
				OnlyFourColumns bz = new OnlyFourColumns(ad, tm, zone, lon, lat, after23NewDay);
				Map<String, Object> map = bz.getNongli();
				chart.put("nongli", map);				
			}

			return res;
		});
		
		Map<String, Object> res = (Map<String, Object>)obj;
		
		TransData.set(res);
	}
	
	private void setupBazi(Map<String, Object> res, Map<String, Object> params) {
		TimeZiAlg timealg = (TimeZiAlg) params.get("timeAlg");
		PhaseType phaseType = (PhaseType) params.get("phaseType");
		boolean zodiacalLon = (boolean) params.get("useZodicalLon");
		String zone = (String) params.get("zone");
		String lat = (String) params.get("lat");
		String lon = (String) params.get("lon");
		String godKeyPos = (String) params.get("godKeyPos");
		List<Map<String, Object>> jieqi24 = (List<Map<String, Object>>) res.get("jieqi24");
		int ad = ConvertUtility.getValueAsInt(params.get("ad"), 1);
		for(Map<String, Object> map : jieqi24) {
			String tmstr = (String) map.get("time");
			BaZi bz = new BaZi(ad, tmstr, zone, lon, lat, timealg, zodiacalLon, godKeyPos, false);
			bz.calculate(phaseType);
			map.put("bazi", bz);
		}
	}

	private Map<String, Object> getYearParams(){
		Map<String, Object> params = new HashMap<String, Object>();
		if(!TransData.containsParam("year")) {
			throw new ErrorCodeException(600001, "miss.year");
		}
		if(!TransData.containsParam("zone")) {
			throw new ErrorCodeException(600003, "miss.zone");
		}
		if(!TransData.containsParam("lat")) {
			throw new ErrorCodeException(600004, "miss.lat");
		}
		if(!TransData.containsParam("lon")) {
			throw new ErrorCodeException(600005, "miss.lon");
		}
		params.put("year", TransData.get("year"));
		params.put("time", TransData.get("time"));
		params.put("zone", TransData.get("zone"));
		params.put("lat", TransData.get("lat"));
		params.put("lon", TransData.get("lon"));
		params.put("hsys", TransData.getValueAsInt("hsys", 0));
		params.put("doubingSu28", TransData.getValueAsBool("doubingSu28", false));
		params.put("southchart", TransData.getValueAsBool("southchart", false));
		if(TransData.containsParam("zodiacal")) {
			params.put("zodiacal", TransData.get("zodiacal"));
		}else {
			params.put("zodiacal", 0);
		}
		if(TransData.containsParam("gpsLat")) {
			params.put("gpsLat", TransData.get("gpsLat"));
			params.put("gpsLon", TransData.get("gpsLon"));
		}
		if(TransData.containsParam("jieqis")) {
			params.put("jieqis", TransData.get("jieqis"));
		}
		int timealg = TransData.getValueAsInt("timeAlg", 0);
		params.put("timeAlg", TimeZiAlg.fromCode(timealg));
		boolean byLon = TransData.getValueAsBool("byLon", false);
		params.put("useZodicalLon", byLon);
		if(TransData.containsParam("godKeyPos")) {
			params.put("godKeyPos", TransData.getValueAsString("godKeyPos"));			
		}else {
			params.put("godKeyPos", GodRule.ZhuNian);	
		}
		
		int phaseType = TransData.getValueAsInt("phaseType", 0);
		params.put("phaseType", PhaseType.fromCode(phaseType));
	
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
		
		return params;
	}
	
}
