package spacex.astrostudycn.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.ConvertUtility;
import spacex.astrostudy.constants.PhaseType;
import spacex.astrostudy.helper.ParamHashCacheHelper;
import spacex.astrostudy.helper.NongliHelper;
import spacex.astrostudy.model.godrule.GodRule;
import spacex.astrostudycn.constants.TimeZiAlg;
import spacex.astrostudycn.model.BaZi;

@Controller
@RequestMapping("/bazi")
public class BaZiBirthController {

	@ResponseBody
	@RequestMapping("/birth")
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
		boolean lateZiHourUseNextDay = (boolean) params.get("lateZiHourUseNextDay");
		boolean gender = (boolean) params.get("gender");
		boolean adjustJieqi = (boolean) params.get("adjustJieqi");
		String godKeyPos = (String) params.get("godKeyPos");
		String minggongMethod = (String) params.get("minggongMethod");
		int ad = ConvertUtility.getValueAsInt(params.get("ad"), 1);

		params.put("_calRev", NongliHelper.CALENDAR_CACHE_REV);   // 历法口径代次:只进缓存键,不参与计算
		Object obj = ParamHashCacheHelper.get("/bazi/birth", params, (args)->{
			BaZi bz = new BaZi(ad, dtstr, zone, lon, lat, timealg, zodiacalLon, godKeyPos, after23NewDay, adjustJieqi, lateZiHourUseNextDay);
			bz.setMinggongMethod(minggongMethod);
			bz.setSouthMonthFlip("chong".equals(params.get("southMonth")));
			bz.calculate(phaseType);
			Map<String, Object> res = new HashMap<String, Object>();
			res.put("bazi", bz);
			res.put("gender", gender ? "Male" : "Female");
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
		if(TransData.containsParam("godKeyPos")) {
			map.put("godKeyPos", TransData.getValueAsString("godKeyPos"));
		}else {
			map.put("godKeyPos", GodRule.ZhuNianRi);
		}
		if(TransData.containsParam("minggongMethod")) {
			map.put("minggongMethod", TransData.getValueAsString("minggongMethod"));
		}else {
			map.put("minggongMethod", "shufa");
		}
		// 南半球月令:chong = 对冲(仅南纬生效),其余 = 不对冲(缺省,与八字主盘同口径)
		map.put("southMonth", "chong".equals(TransData.getValueAsString("southMonth")) ? "chong" : "none");
		int timealg = TransData.getValueAsInt("timeAlg", 0);
		map.put("timeAlg", TimeZiAlg.fromCode(timealg).calcBasis());   // 缓存键与模型同口径(春分定卯时 = 直接时间)
		boolean byLon = TransData.getValueAsBool("byLon", false);
		map.put("useZodicalLon", byLon);
		
		boolean after23NewDay = TransData.getValueAsInt("after23NewDay", 1) == 1;
		map.put("after23NewDay", after23NewDay);

		boolean lateZiHourUseNextDay = TransData.getValueAsInt("lateZiHourUseNextDay", 1) == 1;
		map.put("lateZiHourUseNextDay", lateZiHourUseNextDay);

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
