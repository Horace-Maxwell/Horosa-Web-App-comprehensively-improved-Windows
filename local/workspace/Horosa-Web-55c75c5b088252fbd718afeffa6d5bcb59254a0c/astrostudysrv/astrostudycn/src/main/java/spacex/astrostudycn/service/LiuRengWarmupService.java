package spacex.astrostudycn.service;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import spacex.astrostudy.constants.PhaseType;
import spacex.astrostudy.helper.CacheHelper;
import spacex.astrostudy.model.godrule.GodRule;
import spacex.astrostudycn.constants.TimeZiAlg;
import spacex.astrostudycn.helper.LiuRengHelper;
import spacex.astrostudycn.model.LiuReng;

@Component
public class LiuRengWarmupService {
	private static final AtomicBoolean Started = new AtomicBoolean(false);

	@EventListener(ApplicationReadyEvent.class)
	public void onReady() {
		if(!Started.compareAndSet(false, true)) {
			return;
		}

		Thread t = new Thread(this::warmup, "liureng-runyear-warmup");
		t.setDaemon(true);
		t.start();
	}

	private void warmup() {
		try {
			String zone = "+08:00";
			String lon = "121e28";
			String lat = "31n13";
			Map<String, Object> godsParams = buildBaseParams("2028-04-06", zone, lon, lat);
			Map<String, Object> godsRes = getGods(godsParams);
			String guaYearGanZi = resolveGuaYearGanZi(godsRes);
			if(guaYearGanZi != null && !guaYearGanZi.isEmpty()) {
				Map<String, Object> runyearParams = buildBaseParams("2020-04-06", zone, lon, lat);
				runyearParams.put("gender", true);
				runyearParams.put("guaYearGanZi", guaYearGanZi);
				getRunyear(runyearParams, guaYearGanZi);
			}

			LiuRengHelper.getBirthYearGanZi(1, "2020-02-03 09:33:00", zone, lon, lat, TimeZiAlg.RealSun, false);
			LiuRengHelper.getBirthYearGanZi(1, "2020-02-05 09:33:00", zone, lon, lat, TimeZiAlg.RealSun, false);
		}catch(Throwable ignore) {
		}
	}

	@SuppressWarnings("unchecked")
	private Map<String, Object> getGods(Map<String, Object> params) {
		return (Map<String, Object>) CacheHelper.get("/liureng/gods", params, (args)->{
			LiuReng bz = new LiuReng(1, String.format("%s %s", args.get("date"), args.get("time")), (String) args.get("zone"), (String) args.get("lon"), (String) args.get("lat"), TimeZiAlg.RealSun, false, GodRule.ZhuRiZhu, false);
			bz.calculate(PhaseType.ShuiTu);
			Map<String, Object> res = new HashMap<String, Object>();
			res.put("liureng", bz);
			return res;
		});
	}

	@SuppressWarnings("unchecked")
	private Map<String, Object> getRunyear(Map<String, Object> params, String guaYearGanZi) {
		return (Map<String, Object>) CacheHelper.get("/liureng/runyear", params, (args)->{
			String birthYear = LiuRengHelper.getBirthYearGanZi(1, String.format("%s %s", args.get("date"), args.get("time")), (String) args.get("zone"), (String) args.get("lon"), (String) args.get("lat"), TimeZiAlg.RealSun, false);
			return LiuRengHelper.runYear(birthYear, true, guaYearGanZi);
		});
	}

	@SuppressWarnings("unchecked")
	private String resolveGuaYearGanZi(Map<String, Object> godsRes) {
		if(godsRes == null) {
			return null;
		}
		Object liurengObj = godsRes.get("liureng");
		if(!(liurengObj instanceof LiuReng)) {
			return null;
		}
		LiuReng liureng = (LiuReng) liurengObj;
		Map<String, Object> nongli = liureng.getNongli();
		if(nongli == null || nongli.isEmpty()) {
			return null;
		}
		String[] keys = new String[] {"yearGanZi", "yearJieqi", "year"};
		for(String key : keys) {
			Object value = nongli.get(key);
			if(value != null) {
				String text = String.valueOf(value).trim();
				if(!text.isEmpty()) {
					return text;
				}
			}
		}
		return null;
	}

	private Map<String, Object> buildBaseParams(String date, String zone, String lon, String lat) {
		Map<String, Object> params = new HashMap<String, Object>();
		params.put("date", date);
		params.put("time", "09:33:00");
		params.put("zone", zone);
		params.put("lat", lat);
		params.put("lon", lon);
		params.put("godKeyPos", GodRule.ZhuRiZhu);
		params.put("timeAlg", TimeZiAlg.RealSun);
		params.put("useZodicalLon", false);
		params.put("phaseType", PhaseType.ShuiTu);
		params.put("after23NewDay", false);
		params.put("ad", 1);
		return params;
	}
}
