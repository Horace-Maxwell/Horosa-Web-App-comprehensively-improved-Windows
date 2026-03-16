package spacex.astrostudycn.controller;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;
import spacex.astrostudy.helper.CacheHelper;
import spacex.astrostudycn.constants.TimeZiAlg;
import spacex.astrostudycn.model.OnlyFourColumns;

@Controller
@RequestMapping("/nongli")
public class NongliController {

	@ResponseBody
	@RequestMapping("/time")
	public void execute() {
		Map<String, Object> params = checkParams();
		
		String zone = (String) params.get("zone");
		String lon = (String) params.get("lon");
		String lat = (String) params.get("lat");
		String dtstr = String.format("%s %s", params.get("date"), params.get("time"));
		int ad = ConvertUtility.getValueAsInt(params.get("ad"), 1);
		
		boolean after23NewDay = (boolean) params.get("after23NewDay");
		TimeZiAlg timeAlg = (TimeZiAlg) params.get("timeAlg");
		
		Object obj = CacheHelper.get("/nongli/time", params, (args)->{
			OnlyFourColumns bz = new OnlyFourColumns(ad, dtstr, zone, lon, lat, timeAlg, after23NewDay);
			Map<String, Object> map = bz.getNongli();
			return map;
		});
		
		
		Map<String, Object> res = (Map<String, Object>)obj;		
		TransData.set(res);
		
	}
	
	private Map<String, Object> checkParams(){
		if(!TransData.containsParam("date")) {
			throw new ErrorCodeException(700001, "miss.date");
		}
		if(!TransData.containsParam("time")) {
			throw new ErrorCodeException(700002, "miss.time");
		}
		if(!TransData.containsParam("zone")) {
			throw new ErrorCodeException(700003, "miss.zone");
		}
		if(!TransData.containsParam("lon")) {
			throw new ErrorCodeException(700005, "miss.lon");
		}
		
		Map<String, Object> map = new LinkedHashMap<String, Object>();
		map.put("date", normalizeDate(TransData.getValueAsString("date")));
		map.put("time", normalizeTime(TransData.getValueAsString("time")));
		map.put("zone", normalizeZone(TransData.getValueAsString("zone")));
		map.put("lon", normalizeCoord(TransData.getValueAsString("lon"), "0e00"));
		map.put("lat", normalizeCoord(TransData.getValueAsString("lat"), "0n00"));
		int timealg = TransData.getValueAsInt("timeAlg", 0);
		map.put("timeAlg", TimeZiAlg.fromCode(timealg));
		boolean after23NewDay = TransData.getValueAsBool("after23NewDay", false);
		map.put("after23NewDay", after23NewDay);

		if(TransData.containsParam("ad")) {
			int ad = TransData.getValueAsInt("ad", 1);
			map.put("ad", ad);
			if(ad != 1) {
				String dt = TransData.getValueAsString("date");
				if(dt.indexOf('-') != 0) {
					map.put("date", "-" + dt);
				}
			}			
		}else {
			String dt = TransData.getValueAsString("date");
			if(dt.indexOf('-') == 0) {
				map.put("ad", -1);
			}
		}
		
		
		return map;
	}

	private String normalizeDate(String date) {
		if(StringUtility.isNullOrEmpty(date)) {
			return "";
		}
		return date.trim().replace('/', '-');
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
