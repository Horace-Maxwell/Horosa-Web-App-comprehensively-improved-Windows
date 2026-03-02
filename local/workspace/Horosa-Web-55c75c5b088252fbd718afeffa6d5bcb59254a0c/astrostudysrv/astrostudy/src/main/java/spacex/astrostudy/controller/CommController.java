package spacex.astrostudy.controller;

import java.util.Calendar;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.StringUtility;
import spacex.astrostudy.constants.StemBranch;
import spacex.astrostudy.helper.AstroCacheHelper;
import spacex.astrostudy.helper.BaZiHelper;
import spacex.astrostudy.helper.BaZiPithyHelper;
import spacex.astrostudy.helper.CacheHelper;
import spacex.astrostudy.helper.Gong12Helper;

@Controller
@RequestMapping("/common")
public class CommController {

	@RequestMapping("/delquerycaches")
	@ResponseBody
	public void delQueryCaches(){
		String jieqi = "/jieqi/";
		String bazi = "/bazi/";
		long cnt = 0;
		cnt += CacheHelper.deleteCacheKey(jieqi);
		cnt += CacheHelper.deleteCacheKey(bazi);
		cnt += AstroCacheHelper.deleteCacheKey();
		TransData.set("total", cnt);
	}
	
	@RequestMapping("/naying")
	@ResponseBody
	public void naying() {
		TransData.set("naying", StemBranch.NaYingMap);
		TransData.set("sixty", StemBranch.JiaZi);
	}
	
	@RequestMapping("/inversebazi")
	@ResponseBody
	public void inverseBazi() {
		String yganzi = TransData.getValueAsString("Year");
		String mganzi = TransData.getValueAsString("Month");
		String dganzi = TransData.getValueAsString("Date");
		String tganzi = TransData.getValueAsString("Time");
		
		int cnt = TransData.getValueAsInt("Count", 1);
		boolean desc = TransData.getValueAsBool("Desc", true);
		Calendar now = Calendar.getInstance();
		int fromyear = now.get(Calendar.YEAR);
		if(TransData.containsParam("FromYear")) {
			fromyear = TransData.getValueAsInt("FromYear", fromyear);
		}

		
		String[] dates = BaZiHelper.getBirthes(fromyear, desc, cnt, yganzi, mganzi, dganzi, tganzi);
		
		TransData.set("Dates", dates);
	}
	
	@RequestMapping("/gong12gods")
	@ResponseBody
	public void gong12Gods() {
		TransData.set("stars", Gong12Helper.getStars());
		TransData.set("starSu", Gong12Helper.getStarSu());
		TransData.set("starTypeSu", Gong12Helper.getStarType());
	}
	
	@RequestMapping("/pithy")
	@ResponseBody
	public void baziPithy() {
		Map<String, Object> pithy = BaZiPithyHelper.getPithy();
		TransData.set("pithy", pithy);
	}
	
	@RequestMapping("/gong12")
	@ResponseBody
	public void queryGong12() {
		String gz = TransData.getValueAsString("干支");
		if(StringUtility.isNullOrEmpty(gz)) {
			throw new ErrorCodeException(3333001, "miss.gan.zi");
		}
		Map<String, Object> gong12 = Gong12Helper.getGong12(gz);
		TransData.set("gong12", gong12);
	}
	
}
