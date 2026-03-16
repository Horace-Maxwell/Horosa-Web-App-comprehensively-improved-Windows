package spacex.astrostudy.service;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TimeZone;
import java.util.concurrent.atomic.AtomicBoolean;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import spacex.astrostudy.helper.AstroHelper;
import spacex.astrostudy.helper.ParamHashCacheHelper;

@Component
public class AstroTechniqueWarmupService {
	private static final AtomicBoolean Started = new AtomicBoolean(false);

	@EventListener(ApplicationReadyEvent.class)
	public void onReady() {
		if(!Started.compareAndSet(false, true)) {
			return;
		}

		Thread t = new Thread(this::warmup, "astro-technique-warmup");
		t.setDaemon(true);
		t.start();
	}

	private void warmup() {
		try {
			warmCurrentStartupLike();
			warmRepresentative("2028/04/06", "09:33:00", "+00:00", "174w30", "41n26", 1);
			warmRelativeRepresentative();
		}catch(Throwable ignore) {
		}
	}

	private void warmCurrentStartupLike() {
		SimpleDateFormat dateFmt = new SimpleDateFormat("yyyy/MM/dd");
		SimpleDateFormat timeFmt = new SimpleDateFormat("HH:mm:ss");
		TimeZone tz = TimeZone.getTimeZone("GMT+08:00");
		dateFmt.setTimeZone(tz);
		timeFmt.setTimeZone(tz);
		Date now = new Date();
		warmRepresentative(dateFmt.format(now), timeFmt.format(now), "+08:00", "119e19", "26n04", 0);
	}

	private void warmRepresentative(String date, String time, String zone, String lon, String lat, int hsys) {
		warmAcg(date, time, zone, lon, lat);
		Map<String, Object> params = new LinkedHashMap<String, Object>();
		params.put("date", date);
		params.put("time", time);
		params.put("ad", 1);
		params.put("zone", zone);
		params.put("lat", lat);
		params.put("lon", lon);
		params.put("hsys", hsys);
		params.put("zodiacal", 1);
		params.put("tradition", false);
		params.put("strongRecption", false);
		params.put("virtualPointReceiveAsp", true);
		params.put("simpleAsp", false);
		params.put("predictive", false);
		params.put("includePrimaryDirection", false);
		params.put("southchart", false);
		params.put("chartnum", 1);
		params.put("_wireRev", "pd_method_sync_v6");

		ParamHashCacheHelper.get("/india/chart", params, (args)->AstroHelper.getIndiaChart(args));
	}

	private void warmAcg(String date, String time, String zone, String lon, String lat) {
		Map<String, Object> params = new LinkedHashMap<String, Object>();
		params.put("date", date);
		params.put("time", time);
		params.put("ad", 1);
		params.put("zone", zone);
		params.put("lat", lat);
		params.put("lon", lon);

		AstroHelper.getAcg(params);
	}

	private void warmRelativeRepresentative() {
		Map<String, Object> inner = new LinkedHashMap<String, Object>();
		inner.put("date", "2028/04/06");
		inner.put("time", "09:33:00");
		inner.put("zone", "+00:00");
		inner.put("lat", "41n26");
		inner.put("lon", "174w30");
		inner.put("ad", 1);

		Map<String, Object> outer = new LinkedHashMap<String, Object>();
		outer.put("date", "2029/09/16");
		outer.put("time", "18:45:00");
		outer.put("zone", "+08:00");
		outer.put("lat", "31n13");
		outer.put("lon", "121e28");
		outer.put("ad", 1);

		Map<String, Object> params = new LinkedHashMap<String, Object>();
		params.put("inner", inner);
		params.put("outer", outer);
		params.put("hsys", 1);
		params.put("zodiacal", 0);
		params.put("relative", 0);

		AstroHelper.getRelativeChart(params);
	}
}
