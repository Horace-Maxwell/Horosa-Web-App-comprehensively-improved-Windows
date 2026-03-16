package spacex.astrostudy.controller;


import java.util.LinkedHashMap;
import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;
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
	
	private Map<String, Object> getParams(){
		Map<String, Object> params = new LinkedHashMap<String, Object>();
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
		params.put("date", normalizeDate(TransData.getValueAsString("date")));
		params.put("time", normalizeTime(TransData.getValueAsString("time")));
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
		params.put("zone", normalizeZone(TransData.getValueAsString("zone")));
		params.put("lat", normalizeCoord(TransData.getValueAsString("lat"), "0n00"));
		params.put("lon", normalizeCoord(TransData.getValueAsString("lon"), "0e00"));
		// Bust legacy local/runtime cache entries after PD method/time-key response wiring changes.
		params.put("_wireRev", "pd_method_sync_v6");
		params.put("hsys", TransData.getValueAsInt("hsys", 0));
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
		if(TransData.containsParam("gpsLat")) {
			params.put("gpsLat", TransData.get("gpsLat"));
			params.put("gpsLon", TransData.get("gpsLon"));
		}
		
		return params;
	}

	private String normalizeDate(String date) {
		if(StringUtility.isNullOrEmpty(date)) {
			return "";
		}
		return date.trim().replace('-', '/');
	}

	private String normalizeTime(String time) {
		if(StringUtility.isNullOrEmpty(time)) {
			return "00:00:00";
		}
		String text = time.trim();
		if(text.matches("^\\d{1,2}:\\d{2}$")) {
			return text + ":00";
		}
		return text;
	}

	private String normalizeZone(String zone) {
		if(StringUtility.isNullOrEmpty(zone)) {
			return "+08:00";
		}
		String text = zone.trim()
			.replace("：", ":")
			.replace("UTC", "")
			.replace("utc", "")
			.replace("GMT", "")
			.replace("gmt", "")
			.replace("区", "")
			.replace(" ", "");
		if(text.startsWith("东")) {
			text = "+" + text.substring(1);
		}else if(text.startsWith("西")) {
			text = "-" + text.substring(1);
		}
		if(text.matches("^[+-]?\\d{1,2}:\\d{2}$")) {
			String sign = text.startsWith("-") ? "-" : "+";
			String body = text.startsWith("+") || text.startsWith("-") ? text.substring(1) : text;
			String[] parts = body.split(":");
			return String.format("%s%02d:%02d", sign, ConvertUtility.getValueAsInt(parts[0], 8), ConvertUtility.getValueAsInt(parts[1], 0));
		}
		if(text.matches("^[+-]?\\d{3,4}$")) {
			String sign = text.startsWith("-") ? "-" : "+";
			String body = text.startsWith("+") || text.startsWith("-") ? text.substring(1) : text;
			if(body.length() == 3) {
				body = "0" + body;
			}
			return String.format("%s%s:%s", sign, body.substring(0, 2), body.substring(2));
		}
		if(text.matches("^[+-]?\\d{1,2}$")) {
			int hour = ConvertUtility.getValueAsInt(text, 8);
			return String.format("%s%02d:00", hour < 0 ? "-" : "+", Math.abs(hour));
		}
		if(text.matches("^[+-]\\d{2}$")) {
			String sign = text.substring(0, 1);
			int hour = ConvertUtility.getValueAsInt(text.substring(1), 8);
			return String.format("%s%02d:00", sign, hour);
		}
		return "+08:00";
	}

	private String normalizeCoord(String coord, String fallback) {
		if(StringUtility.isNullOrEmpty(coord)) {
			return fallback;
		}
		String text = coord.trim().toLowerCase().replace(" ", "");
		return text.isEmpty() ? fallback : text;
	}
}
