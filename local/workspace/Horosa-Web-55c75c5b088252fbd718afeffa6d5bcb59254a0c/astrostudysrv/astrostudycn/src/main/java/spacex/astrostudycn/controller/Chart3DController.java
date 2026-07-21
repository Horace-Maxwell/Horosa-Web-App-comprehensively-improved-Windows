package spacex.astrostudycn.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.JsonUtility;
import spacex.astrostudy.helper.AstroHelper;

/**
 * 3D 星盘状态接口:参数白名单逐参一行(防静默丢参)→ 转发 Python :8899 /chart3d/state → 原样返回。
 * 与 PlanetariumController 同形态。
 */
@Controller
@RequestMapping("/chart3d")
public class Chart3DController {

	@ResponseBody
	@RequestMapping("/state")
	public void state(){
		Map<String, Object> params = getParams();
		Map<String, Object> res = AstroHelper.getChart3DState(params);
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
		// 以下可选参逐参守卫透传:默认不带 → 请求体与最小态一致;缺一行 = Java 静默丢参(三层白名单铁律)。
		// 视角中心:单字符串参数(如 "earth"/"sun"),原值透传由 Python 定语义与默认。
		if(TransData.containsParam("center")) {
			params.put("center", TransData.get("center"));
		}
		if(TransData.containsParam("includeMoon")) {
			params.put("includeMoon", TransData.get("includeMoon"));
		}
		if(TransData.containsParam("orbitSamples")) {
			params.put("orbitSamples", TransData.get("orbitSamples"));
		}
		if(TransData.containsParam("asporb")) {
			params.put("asporb", TransData.get("asporb"));
		}
		// 相位集:可能以 JSON 字符串形态到达(照 PredictiveController pdaspects 的解码形态),Python 侧收列表。
		if(TransData.containsParam("aspects")) {
			Object aspobj = TransData.get("aspects");
			if(aspobj instanceof String) {
				aspobj = JsonUtility.decodeList((String)aspobj, String.class);
			}
			params.put("aspects", aspobj);
		}
		return params;
	}
}
