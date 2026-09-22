package spacex.astrostudycn.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.ConvertUtility;
import spacex.astrostudy.helper.AstroHelper;

@Controller
@RequestMapping("/planetarium")
public class PlanetariumController {

	@ResponseBody
	@RequestMapping("/state")
	public void state(){
		Map<String, Object> params = getParams();
		Map<String, Object> res = AstroHelper.requestNoCache("/planetarium/state", params);
		TransData.set(res);
	}

	private Map<String, Object> getParams(){
		Map<String, Object> params = new HashMap<String, Object>();
		if(!TransData.containsParam("date")) {
			throw new ErrorCodeException(100001, "miss.date");
		}
		if(!TransData.containsParam("time")) {
			throw new ErrorCodeException(100002, "miss.time");
		}
		if(!TransData.containsParam("zone")) {
			throw new ErrorCodeException(100003, "miss.zone");
		}
		if(!TransData.containsParam("lat")) {
			throw new ErrorCodeException(100004, "miss.lat");
		}
		if(!TransData.containsParam("lon")) {
			throw new ErrorCodeException(100005, "miss.lon");
		}
		params.put("date", TransData.get("date"));
		params.put("time", TransData.get("time"));
		if(TransData.containsParam("ad")) {
			int ad = TransData.getValueAsInt("ad", 1);
			params.put("ad", ad);
			if(ad != 1) {
				String dt = TransData.getValueAsString("date");
				if(dt.indexOf('-') != 0) {
					params.put("date", "-" + dt);
				}
			}
		}
		params.put("zone", TransData.get("zone"));
		params.put("lat", TransData.get("lat"));
		params.put("lon", TransData.get("lon"));
		params.put("hsys", TransData.getValueAsInt("hsys", 1));
		params.put("zodiacal", TransData.getValueAsInt("zodiacal", 0));
		if(TransData.containsParam("siderealAyanamsa")) {
			params.put("siderealAyanamsa", TransData.get("siderealAyanamsa"));
		}
		params.put("doubingSu28", TransData.getValueAsInt("doubingSu28", 0));
		params.put("southchart", TransData.getValueAsBool("southchart", false));
		params.put("predictive", false);
		params.put("starLimit", TransData.getValueAsInt("starLimit", 9000));
		if(TransData.containsParam("gpsLat")) {
			params.put("gpsLat", TransData.get("gpsLat"));
		}
		if(TransData.containsParam("gpsLon")) {
			params.put("gpsLon", TransData.get("gpsLon"));
		}
		if(TransData.containsParam("name")) {
			params.put("name", TransData.get("name"));
		}
		if(TransData.containsParam("pos")) {
			params.put("pos", TransData.get("pos"));
		}
		// 行星轨迹 / 升落时刻门控:仅当前端开启对应图层才带此 flag,透传给 Python(_build_trails / _build_rise_set);
		// 默认不带 → 请求体与原状字节一致(零回归)。此前未登记白名单 → Java 静默丢 → 行星轨迹/升落时刻全失效。
		if(TransData.containsParam("includeTrails")) {
			params.put("includeTrails", TransData.getValueAsInt("includeTrails", 0));
		}
		if(TransData.containsParam("includeRiseSet")) {
			params.put("includeRiseSet", TransData.getValueAsInt("includeRiseSet", 0));
		}
		// [TL-08] 轻量首帧 / 播放校准显式发 includeOverlays:false、includeTraditions:false 以省叠加层与传统层;
		// 此前两键未登记白名单 → Java 静默丢 → Python 缺省 True,每 5–15 s 一次的校准照样全算全传。布尔透传(Python 判 `is not False`)。
		if(TransData.containsParam("includeOverlays")) {
			params.put("includeOverlays", TransData.getValueAsBool("includeOverlays", true));
		}
		if(TransData.containsParam("includeTraditions")) {
			params.put("includeTraditions", TransData.getValueAsBool("includeTraditions", true));
		}
		return params;
	}
}
