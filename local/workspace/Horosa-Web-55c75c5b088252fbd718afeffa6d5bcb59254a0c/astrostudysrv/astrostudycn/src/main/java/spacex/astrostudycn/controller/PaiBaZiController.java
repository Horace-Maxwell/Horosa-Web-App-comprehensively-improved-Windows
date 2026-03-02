package spacex.astrostudycn.controller;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.ConvertUtility;
import boundless.utility.FormatUtility;
import spacex.astrostudy.constants.PhaseType;
import spacex.astrostudy.helper.CacheHelper;
import spacex.astrostudy.model.godrule.GodRule;
import spacex.astrostudycn.constants.TimeZiAlg;
import spacex.astrostudycn.model.BaZi;
import spacex.astrostudycn.model.BaZiDirect;

@Controller
@RequestMapping("/bazi")
public class PaiBaZiController {

	@ResponseBody
	@RequestMapping("/direct")
	public void birth(){
		Map<String, Object> params = checkParams();
		
		String zone = TransData.getValueAsString("zone");
		String lat = TransData.getValueAsString("lat");
		String lon = TransData.getValueAsString("lon");
		String dtstr = String.format("%s %s", params.get("date"), params.get("time"));
		TimeZiAlg timealg = (TimeZiAlg) params.get("timeAlg");
		PhaseType phaseType = (PhaseType) params.get("phaseType");
		boolean zodiacalLon = (boolean) params.get("useZodicalLon");
		boolean after23NewDay = (boolean) params.get("after23NewDay");
		boolean gender = (boolean) params.get("gender");
		boolean adjustJieqi = (boolean) params.get("adjustJieqi");
		String godKeyPos = (String) params.get("godKeyPos");
		int ad = ConvertUtility.getValueAsInt(params.get("ad"), 1);
		
		Object obj = CacheHelper.get("/bazi/direct", params, (args)->{
			BaZiDirect bz = new BaZiDirect(ad, dtstr, zone, lon, lat, timealg, zodiacalLon, godKeyPos, after23NewDay, gender, adjustJieqi);
			bz.calculate(phaseType);
			Map<String, Object> res = new HashMap<String, Object>();
			res.put("bazi", bz);
			return res;
		});
		
		Map<String, Object> res = (Map<String, Object>)obj;		
		TransData.set(res);
	}

	private Map<String, Object> checkParams(){
		if(!TransData.containsParam("date")) {
			throw new ErrorCodeException(600001, "miss.date");
		}
		if(!TransData.containsParam("time")) {
			throw new ErrorCodeException(600002, "miss.time");
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
		
		Map<String, Object> map = new HashMap<String, Object>();
		map.put("date", TransData.getValueAsString("date"));
		map.put("time", TransData.getValueAsString("time"));
		map.put("zone", TransData.getValueAsString("zone"));
		map.put("lat", TransData.getValueAsString("lat"));
		map.put("lon", TransData.getValueAsString("lon"));
		int timealg = TransData.getValueAsInt("timeAlg", 0);
		map.put("timeAlg", TimeZiAlg.fromCode(timealg));
		boolean byLon = TransData.getValueAsBool("byLon", false);
		map.put("useZodicalLon", byLon);
		if(TransData.containsParam("godKeyPos")) {
			map.put("godKeyPos", TransData.getValueAsString("godKeyPos"));			
		}else {
			map.put("godKeyPos", GodRule.ZhuNianRi);	
		}
		boolean after23NewDay = TransData.getValueAsBool("after23NewDay", false);
		map.put("after23NewDay", after23NewDay);
		
		map.put("gender", TransData.getValueAsBool("gender", true));
		map.put("adjustJieqi", TransData.getValueAsBool("adjustJieqi", false));
		
		int phaseType = TransData.getValueAsInt("phaseType", 0);
		map.put("phaseType", PhaseType.fromCode(phaseType));

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
