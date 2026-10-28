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
import spacex.astrostudy.helper.NongliHelper;
import spacex.astrostudy.model.NongLi;
import spacex.astrostudycn.constants.BaZiGender;
import spacex.astrostudycn.constants.TimeZiAlg;
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
		int timeAlgCode = ConvertUtility.getValueAsInt(params.get("timeAlg"), 0);
		TimeZiAlg timeAlg = TimeZiAlg.fromCode(timeAlgCode);
		
		boolean after23NewDay = (boolean) params.get("after23NewDay");
		boolean lateZiHourUseNextDay = (boolean) params.get("lateZiHourUseNextDay");

		Object obj = CacheHelper.get("/nongli/time", params, (args)->{
			OnlyFourColumns bz = new OnlyFourColumns(ad, dtstr, zone, lon, lat, after23NewDay, BaZiGender.Male, timeAlg, false, lateZiHourUseNextDay);
			Map<String, Object> map = bz.getNongli();
			if(timeAlg == TimeZiAlg.DirectTime) {
				NongLi directNongli = NongliHelper.getNongLi(ad, dtstr, zone, lon, after23NewDay, true, lateZiHourUseNextDay);
				if(directNongli != null) {
					Map<String, Object> directMap = directNongli.toMap();
					Object bazi = map.get("bazi");
					Object direct = map.get("direct");
					map.clear();
					map.putAll(directMap);
					if(bazi != null) {
						map.put("bazi", bazi);
					}
					if(direct != null) {
						map.put("direct", direct);
					}
				}
			}
			return map;
		});
		
		
		Map<String, Object> res = (Map<String, Object>)obj;		
		TransData.set(res);
		
	}
	
	/** 请求里的时间算法 → 农历换算实际口径(0 真太阳时 / 1 直接时间 / 3 平太阳时;2 春分定卯时 = 直接时间;未知 = 真太阳时)。 */
	public static int nongliTimeAlgCode(int raw) {
		return TimeZiAlg.fromCode(raw).calcBasis().getCode();
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
		boolean after23NewDay = TransData.getValueAsInt("after23NewDay", 1) == 1;
		map.put("after23NewDay", after23NewDay);
		boolean lateZiHourUseNextDay = TransData.getValueAsInt("lateZiHourUseNextDay", 1) == 1;
		map.put("lateZiHourUseNextDay", lateZiHourUseNextDay);
		// 四档按实际换算口径归一(0 真太阳时 / 1 直接时间 / 3 平太阳时;2 春分定卯时 = 直接时间):
		// 此前只认 1,2 / 3 都被折成真太阳时,与八字 / 本地引擎同一档不同时刻
		map.put("timeAlg", nongliTimeAlgCode(TransData.getValueAsInt("timeAlg", 0)));

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
