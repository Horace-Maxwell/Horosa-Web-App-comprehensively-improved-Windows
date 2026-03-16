package spacex.astrostudycn.service;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TimeZone;
import java.util.concurrent.atomic.AtomicBoolean;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import spacex.astrostudy.constants.PhaseType;
import spacex.astrostudy.helper.CacheHelper;
import spacex.astrostudy.model.godrule.GodRule;
import spacex.astrostudycn.constants.BaZiGender;
import spacex.astrostudycn.constants.TimeZiAlg;
import spacex.astrostudycn.model.BaZiDirect;
import spacex.astrostudycn.model.LiuReng;
import spacex.astrostudycn.model.OnlyFourColumns;
import spacex.astrostudycn.model.ZiWeiChart;

@Component
public class CnTechniqueWarmupService {
	private static final AtomicBoolean Started = new AtomicBoolean(false);

	@EventListener(ApplicationReadyEvent.class)
	public void onReady() {
		if(!Started.compareAndSet(false, true)) {
			return;
		}

		Thread t = new Thread(this::warmup, "cn-technique-warmup");
		t.setDaemon(true);
		t.start();
	}

	private void warmup() {
		try {
			warmCurrentStartupLike();
			warmRepresentative("2028-04-06", "09:33:00", "+08:00", "121e28", "31n13");
		}catch(Throwable ignore) {
		}
	}

	private void warmCurrentStartupLike() {
		SimpleDateFormat dateFmt = new SimpleDateFormat("yyyy-MM-dd");
		SimpleDateFormat timeFmt = new SimpleDateFormat("HH:mm:ss");
		TimeZone tz = TimeZone.getTimeZone("GMT+08:00");
		dateFmt.setTimeZone(tz);
		timeFmt.setTimeZone(tz);
		Date now = new Date();
		warmRepresentative(dateFmt.format(now), timeFmt.format(now), "+08:00", "119e19", "26n04");
	}

	private void warmRepresentative(String date, String time, String zone, String lon, String lat) {
		warmLiureng(date, time, zone, lon, lat);
		warmNongli(date, time, zone, lon, lat);
		warmZiwei(date, time, zone, lon, lat);
		warmBaziDirect(date, time, zone, lon, lat);
	}

	private void warmNongli(String date, String time, String zone, String lon, String lat) {
		Map<String, Object> params = new LinkedHashMap<String, Object>();
		params.put("date", date);
		params.put("time", time);
		params.put("zone", zone);
		params.put("lon", lon);
		params.put("lat", lat);
		params.put("timeAlg", TimeZiAlg.RealSun);
		params.put("after23NewDay", false);
		params.put("ad", 1);

		CacheHelper.get("/nongli/time", params, (args)->{
			String dtstr = String.format("%s %s", args.get("date"), args.get("time"));
			OnlyFourColumns bz = new OnlyFourColumns(1, dtstr, zone, lon, lat, TimeZiAlg.RealSun, false);
			return bz.getNongli();
		}, true, 7200);
	}

	private void warmZiwei(String date, String time, String zone, String lon, String lat) {
		Map<String, Object> params = new LinkedHashMap<String, Object>();
		params.put("date", date);
		params.put("time", time);
		params.put("zone", zone);
		params.put("lat", lat);
		params.put("lon", lon);
		params.put("gender", true);
		params.put("after23NewDay", false);
		params.put("ad", 1);

		CacheHelper.get("/ziwei/birth", params, (args)->{
			String dtstr = String.format("%s %s", args.get("date"), args.get("time"));
			ZiWeiChart chart = new ZiWeiChart(1, BaZiGender.Male, dtstr, zone, lon, lat, false, null);
			Map<String, Object> res = new HashMap<String, Object>();
			res.put("chart", chart);
			return res;
		}, true, 7200);
	}

	private void warmBaziDirect(String date, String time, String zone, String lon, String lat) {
		Map<String, Object> params = new LinkedHashMap<String, Object>();
		params.put("date", date);
		params.put("time", time);
		params.put("zone", zone);
		params.put("lat", lat);
		params.put("lon", lon);
		params.put("timeAlg", TimeZiAlg.RealSun);
		params.put("useZodicalLon", false);
		params.put("godKeyPos", GodRule.ZhuNianRi);
		params.put("after23NewDay", false);
		params.put("gender", true);
		params.put("adjustJieqi", false);
		params.put("phaseType", PhaseType.HuoTu);
		params.put("ad", 1);

		CacheHelper.get("/bazi/direct", params, (args)->{
			String dtstr = String.format("%s %s", args.get("date"), args.get("time"));
			BaZiDirect bz = new BaZiDirect(1, dtstr, zone, lon, lat, TimeZiAlg.RealSun, false, GodRule.ZhuNianRi, false, true, false);
			bz.calculate(PhaseType.HuoTu);
			Map<String, Object> res = new HashMap<String, Object>();
			res.put("bazi", bz);
			return res;
		}, true, 7200);
	}

	private void warmLiureng(String date, String time, String zone, String lon, String lat) {
		Map<String, Object> params = new LinkedHashMap<String, Object>();
		params.put("date", date);
		params.put("time", time);
		params.put("zone", zone);
		params.put("lat", lat);
		params.put("lon", lon);
		params.put("godKeyPos", GodRule.ZhuRiZhu);
		params.put("timeAlg", TimeZiAlg.RealSun);
		params.put("useZodicalLon", false);
		params.put("phaseType", PhaseType.ShuiTu);
		params.put("after23NewDay", false);
		params.put("ad", 1);

		CacheHelper.get("/liureng/gods", params, (args)->{
			String dtstr = String.format("%s %s", args.get("date"), args.get("time"));
			LiuReng bz = new LiuReng(1, dtstr, zone, lon, lat, TimeZiAlg.RealSun, false, GodRule.ZhuRiZhu, false);
			bz.calculate(PhaseType.ShuiTu);
			Map<String, Object> res = new HashMap<String, Object>();
			res.put("liureng", bz);
			return res;
		}, true, 7200);
	}
}
