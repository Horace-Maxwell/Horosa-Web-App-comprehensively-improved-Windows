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
import spacex.astrostudycn.constants.BaZiGender;
import spacex.astrostudycn.helper.ZWRulesHelper;
import spacex.astrostudycn.helper.ZiWeiHelper;
import spacex.astrostudycn.model.ZiWeiChart;

@Controller
@RequestMapping("/ziwei")
public class ZiWeiController {

	@ResponseBody
	@RequestMapping("/birth")
	public void birth() {
		Map<String, Object> params = checkParams();
		
		String zone = TransData.getValueAsString("zone");
		String lat = TransData.getValueAsString("lat");
		String lon = TransData.getValueAsString("lon");
		String dtstr = String.format("%s %s", params.get("date"), params.get("time"));
		int ad = ConvertUtility.getValueAsInt(params.get("ad"), 1);
		
		boolean after23NewDay = (boolean) params.get("after23NewDay");
		boolean genderval = (boolean) params.get("gender");
		BaZiGender gender = BaZiGender.fromValue(genderval);
		
		Object obj = CacheHelper.get("/ziwei/birth", params, (args)->{
			Map<String, Map<String, String>> sihua = (Map<String, Map<String, String>>) params.get("sihua");
			ZiWeiChart chart = new ZiWeiChart(ad, gender, dtstr, zone, lon, lat, after23NewDay, sihua);
			Map<String, Object> res = new HashMap<String, Object>();
			
			res.put("chart", chart);
			return res;			
		});
		
		Map<String, Object> res = (Map<String, Object>)obj;		
		TransData.set(res);
	}
	
	private Map<String, Object> checkParams(){
		if(!TransData.containsParam("date")) {
			throw new ErrorCodeException(800001, "miss.date");
		}
		if(!TransData.containsParam("time")) {
			throw new ErrorCodeException(800002, "miss.time");
		}
		if(!TransData.containsParam("zone")) {
			throw new ErrorCodeException(800003, "miss.zone");
		}
		if(!TransData.containsParam("lat")) {
			throw new ErrorCodeException(800004, "miss.lat");
		}
		if(!TransData.containsParam("lon")) {
			throw new ErrorCodeException(800005, "miss.lon");
		}
		
		Map<String, Object> map = new HashMap<String, Object>();
		map.put("date", TransData.getValueAsString("date"));
		map.put("time", TransData.getValueAsString("time"));
		map.put("zone", TransData.getValueAsString("zone"));
		map.put("lat", TransData.getValueAsString("lat"));
		map.put("lon", TransData.getValueAsString("lon"));
		map.put("gender", TransData.getValueAsBool("gender", true));
		boolean after23NewDay = TransData.getValueAsBool("after23NewDay", false);
		map.put("after23NewDay", after23NewDay);
		
		if(TransData.containsParam("sihua")) {
			Map<String, List<String>> sihuamap = (Map<String, List<String>>) TransData.get("sihua");
			Map<String, Map<String, String>> huamap = new HashMap<String, Map<String, String>>();
			for(Map.Entry<String, List<String>> entry : sihuamap.entrySet()) {
				String gan = entry.getKey();
				List<String> val = entry.getValue();
				String[] stars = new String[4];
				val.toArray(stars);
				Map<String, String> sihua = new HashMap<String, String>();
				sihua.put(stars[0], ZiWeiHelper.SiHua[0]);
				sihua.put(stars[1], ZiWeiHelper.SiHua[1]);
				sihua.put(stars[2], ZiWeiHelper.SiHua[2]);
				sihua.put(stars[3], ZiWeiHelper.SiHua[3]);
				huamap.put(gan, sihua);
			}
			map.put("sihua", huamap);
		}
		
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
	
	
	@ResponseBody
	@RequestMapping("/rules")
	public void rules() {
		Map<String, Object> map = ZWRulesHelper.getRules();
		TransData.set(map);
	}
}
