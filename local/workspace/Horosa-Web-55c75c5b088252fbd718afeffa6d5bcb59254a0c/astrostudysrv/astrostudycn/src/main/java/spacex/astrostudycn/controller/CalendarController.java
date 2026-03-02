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
import spacex.astrostudy.helper.CacheHelper;
import spacex.astrostudy.model.NongLi;
import spacex.astrostudycn.helper.CalendarHelper;

@Controller
@RequestMapping("/calendar")
public class CalendarController {

	
	@ResponseBody
	@RequestMapping("/month")
	public void execute() {
		Map<String, Object> params = checkParams();
		
		String date = TransData.getValueAsString("date");
		String zone = TransData.getValueAsString("zone");
		String lat = TransData.getValueAsString("lat");
		String lon = TransData.getValueAsString("lon");
		int ad = ConvertUtility.getValueAsInt(params.get("ad"), 1);
		
		Object obj = CacheHelper.get("/calendar/month", params, (args)->{
			Map<String, Object> map = CalendarHelper.getMonthDays(date, zone, ad, lon, lat);
			return map;
		});
		
		Map<String, Object> res = (Map<String, Object>)obj;		
		TransData.set(res);
		
	}
	
	private Map<String, Object> checkParams(){
		if(!TransData.containsParam("date")) {
			throw new ErrorCodeException(900001, "miss.date");
		}
		if(!TransData.containsParam("zone")) {
			throw new ErrorCodeException(900003, "miss.zone");
		}
		if(!TransData.containsParam("lon")) {
			throw new ErrorCodeException(900005, "miss.lon");
		}
		
		Map<String, Object> map = new HashMap<String, Object>();
		map.put("date", TransData.getValueAsString("date"));
		map.put("time", "12:00:00");
		map.put("zone", TransData.getValueAsString("zone"));
		map.put("lat", "0n00");
		map.put("lon", TransData.getValueAsString("lon"));

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
