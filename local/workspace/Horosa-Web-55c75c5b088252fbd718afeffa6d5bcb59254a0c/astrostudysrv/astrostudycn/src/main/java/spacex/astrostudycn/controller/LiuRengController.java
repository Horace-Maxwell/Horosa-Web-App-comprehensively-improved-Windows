package spacex.astrostudycn.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;
import spacex.astrostudy.constants.PhaseType;
import spacex.astrostudy.helper.ParamHashCacheHelper;
import spacex.astrostudy.model.FourColumns;
import spacex.astrostudy.model.godrule.GodRule;
import spacex.astrostudycn.constants.TimeZiAlg;
import spacex.astrostudycn.helper.LiuRengHelper;
import spacex.astrostudycn.model.BaZi;
import spacex.astrostudycn.model.LiuReng;

@Controller
@RequestMapping("/liureng")
public class LiuRengController {

	@ResponseBody
	@RequestMapping("/gods")
	public void gods() {

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
		String godKeyPos = (String) params.get("godKeyPos");
		String yue = (String) params.get("yue");
		Boolean isDiurnal = (Boolean) params.get("isDiurnal");
		int ad = ConvertUtility.getValueAsInt(params.get("ad"), 1);

		Object obj = ParamHashCacheHelper.get("/liureng/gods", params, (args)->{
			LiuReng bz = new LiuReng(ad, dtstr, zone, lon, lat, timealg, zodiacalLon, godKeyPos, after23NewDay, lateZiHourUseNextDay);
			if(!StringUtility.isNullOrEmpty(yue) && isDiurnal != null) {
				bz = new LiuReng(ad, dtstr, zone, lon, lat, timealg, zodiacalLon, godKeyPos, after23NewDay, yue, isDiurnal, lateZiHourUseNextDay);
			}else{
				bz = new LiuReng(ad, dtstr, zone, lon, lat, timealg, zodiacalLon, godKeyPos, after23NewDay, lateZiHourUseNextDay);
			}
			bz.calculate(phaseType);
			Map<String, Object> res = new HashMap<String, Object>();
			res.put("liureng", bz);
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

		map.put("godKeyPos", GodRule.ZhuRiZhu);	
		// [Q-386/T-367] 时间算法改为读参,缺省仍 RealSun(真太阳时)=现状字节不变。
		// 病灶:独立六壬页此前无此控件、后端写死真太阳时,而三式合一的六壬层时柱取自奇门(奇门吃 timeAlg)
		// → 全局或合一选「直接时间」时,同一时刻两页六壬时柱可分属两个时辰,月将加时与天地盘整体不同。
		// 注:本键恒入 params(缺省也 put),故 ParamHash 缓存键对所有请求一致变更、不会与旧键碰撞。
		int timeAlgCode = TransData.getValueAsInt("timeAlg", TimeZiAlg.RealSun.getCode());
		map.put("timeAlg", TimeZiAlg.fromCode(timeAlgCode));
		map.put("useZodicalLon", false);
		map.put("phaseType", PhaseType.ShuiTu);

		boolean after23NewDay = TransData.getValueAsInt("after23NewDay", 1) == 1;
		map.put("after23NewDay", after23NewDay);

		boolean lateZiHourUseNextDay = TransData.getValueAsInt("lateZiHourUseNextDay", 1) == 1;
		map.put("lateZiHourUseNextDay", lateZiHourUseNextDay);

		if(TransData.containsParam("yue")) {
			map.put("yue", TransData.getValueAsString("yue"));
		}
		if(TransData.containsParam("isDiurnal")) {
			map.put("isDiurnal", TransData.getValueAsBool("isDiurnal", true));
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

	private Integer parseSolarYear(String date) {
		if(StringUtility.isNullOrEmpty(date)) {
			return null;
		}
		String dt = date.trim();
		boolean neg = false;
		if(dt.startsWith("-")) {
			neg = true;
			dt = dt.substring(1);
		}
		String[] parts = dt.split("-");
		if(parts.length == 0) {
			return null;
		}
		int y = ConvertUtility.getValueAsInt(parts[0], Integer.MIN_VALUE);
		if(y == Integer.MIN_VALUE) {
			return null;
		}
		return neg ? -y : y;
	}
	
	@ResponseBody
	@RequestMapping("/runyear")
	public void runyear() {
		String guaYearGanZi = TransData.getValueAsString("guaYearGanZi");
		boolean male = TransData.getValueAsBool("gender", true);
		
		Map<String, Object> params = checkParams();
		params.put("gender", male);
		
		String zone = TransData.getValueAsString("zone");
		String lat = TransData.getValueAsString("lat");
		String lon = TransData.getValueAsString("lon");		
		String dtstr = String.format("%s %s", params.get("date"), TransData.getValueAsString("time"));
		TimeZiAlg timealg = (TimeZiAlg) params.get("timeAlg");
		PhaseType phaseType = (PhaseType) params.get("phaseType");
		boolean zodiacalLon = (boolean) params.get("useZodicalLon");
		boolean after23NewDay = (boolean) params.get("after23NewDay");
		boolean lateZiHourUseNextDay = (boolean) params.get("lateZiHourUseNextDay");
		String godKeyPos = (String) params.get("godKeyPos");
		int ad = ConvertUtility.getValueAsInt(params.get("ad"), 1);

		String guaDate = TransData.getValueAsString("guaDate");
		String guaTime = TransData.getValueAsString("guaTime");
		String guaZone = TransData.getValueAsString("guaZone");
		String guaLon = TransData.getValueAsString("guaLon");
		String guaLat = TransData.getValueAsString("guaLat");
		int guaAd = TransData.getValueAsInt("guaAd", ad);
		boolean guaAfter23NewDay = TransData.getValueAsInt("guaAfter23NewDay", after23NewDay ? 1 : 0) == 1;

		if(!StringUtility.isNullOrEmpty(guaDate)) {
			if(guaAd != 1 && guaDate.indexOf('-') != 0) {
				guaDate = "-" + guaDate;
			}else if(guaAd == 1 && guaDate.indexOf('-') == 0) {
				guaDate = guaDate.substring(1);
			}
		}
		if(StringUtility.isNullOrEmpty(guaTime)) {
			guaTime = TransData.getValueAsString("time");
		}
		if(StringUtility.isNullOrEmpty(guaZone)) {
			guaZone = zone;
		}
		if(StringUtility.isNullOrEmpty(guaLon)) {
			guaLon = lon;
		}
		if(StringUtility.isNullOrEmpty(guaLat)) {
			guaLat = lat;
		}

		final String reqGuaYearGanZi = guaYearGanZi;
		final String reqGuaDate = guaDate;
		final String reqGuaTime = guaTime;
		final String reqGuaZone = guaZone;
		final String reqGuaLon = guaLon;
		final String reqGuaLat = guaLat;
		final int reqGuaAd = guaAd;
		final boolean reqGuaAfter23NewDay = guaAfter23NewDay;

		params.put("guaYearGanZi", reqGuaYearGanZi);
		params.put("guaDate", reqGuaDate);
		params.put("guaTime", reqGuaTime);
		params.put("guaZone", reqGuaZone);
		params.put("guaLon", reqGuaLon);
		params.put("guaLat", reqGuaLat);
		params.put("guaAd", reqGuaAd);
		params.put("guaAfter23NewDay", reqGuaAfter23NewDay);
		
		Object obj = ParamHashCacheHelper.get("/liureng/runyear", params, (args)->{
			BaZi bz = new BaZi(ad, dtstr, zone, lon, lat, timealg, zodiacalLon, godKeyPos, after23NewDay, false, lateZiHourUseNextDay);
			bz.calculateFourColumn(phaseType);
			FourColumns fourcols = bz.getFourColums();

			String useGuaYearGanZi = reqGuaYearGanZi;
			if(!LiuRengHelper.isValidGanZi(useGuaYearGanZi)
				&& !StringUtility.isNullOrEmpty(reqGuaDate)
				&& !StringUtility.isNullOrEmpty(reqGuaTime)) {
				String guaDtStr = String.format("%s %s", reqGuaDate, reqGuaTime);
				BaZi guaBz = new BaZi(reqGuaAd, guaDtStr, reqGuaZone, reqGuaLon, reqGuaLat, timealg, zodiacalLon, godKeyPos, reqGuaAfter23NewDay, false, lateZiHourUseNextDay);
				guaBz.calculateFourColumn(phaseType);
				FourColumns guaCols = guaBz.getFourColums();
				if(guaCols != null && guaCols.year != null) {
					useGuaYearGanZi = guaCols.year.ganzi;
				}
			}
			if(!LiuRengHelper.isValidGanZi(useGuaYearGanZi)) {
				throw new ErrorCodeException(800006, "miss.gua.yearganzi");
			}
			Integer birthYear = parseSolarYear((String) params.get("date"));
			Integer guaYear = parseSolarYear(reqGuaDate);
			Map<String, Object> res = LiuRengHelper.runYear(fourcols, male, useGuaYearGanZi, birthYear, guaYear);
			return res;
		});
		
		Map<String, Object> res = (Map<String, Object>)obj;		
		TransData.set(res);
		
	}
	
	
}
