package spacex.astrostudycn.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.ConvertUtility;
import spacex.astrostudy.helper.CacheHelper;
import spacex.astrostudycn.model.OnlyFourColumns;

@Controller
@RequestMapping("/nongli")
public class NongliController {

	@ResponseBody
	@RequestMapping("/time")
	public void execute() {
		Map<String, Object> params = checkParams();
		
		String zone = TransData.getValueAsString("zone");
		String lon = TransData.getValueAsString("lon");
		String lat = TransData.getValueAsString("lat");
		String dtstr = String.format("%s %s", params.get("date"), params.get("time"));
		int ad = ConvertUtility.getValueAsInt(params.get("ad"), 1);
		
		boolean after23NewDay = (boolean) params.get("after23NewDay");
		
		Object obj = CacheHelper.get("/nongli/time", params, (args)->{
			OnlyFourColumns bz = new OnlyFourColumns(ad, dtstr, zone, lon, lat, after23NewDay);
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
		
		Map<String, Object> map = new HashMap<String, Object>();
		map.put("date", TransData.getValueAsString("date"));
		map.put("time", TransData.getValueAsString("time"));
		map.put("zone", TransData.getValueAsString("zone"));
		map.put("lon", TransData.getValueAsString("lon"));
		map.put("lat", "0n00");
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
	
}
