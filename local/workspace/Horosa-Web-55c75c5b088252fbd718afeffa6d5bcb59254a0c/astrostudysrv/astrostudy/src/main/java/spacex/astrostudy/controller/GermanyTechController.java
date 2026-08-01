package spacex.astrostudy.controller;


import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import spacex.astrostudy.helper.AstroHelper;

@Controller
@RequestMapping("/germany")
public class GermanyTechController {

	@ResponseBody
	@RequestMapping("/midpoint")
	public void midpoint(){
		Map<String, Object> params = getParams();
		
		Map<String, Object> res = AstroHelper.getGermanyTech(params);
		
		TransData.set(res);
	}
	
	private Map<String, Object> getParams(){
		Map<String, Object> params = new HashMap<String, Object>();
		if(!TransData.containsParam("date")) {
			throw new ErrorCodeException(300001, "miss.date");
		}
		if(!TransData.containsParam("time")) {
			throw new ErrorCodeException(300002, "miss.time");
		}
		if(!TransData.containsParam("zone")) {
			throw new ErrorCodeException(300003, "miss.zone");
		}
		if(!TransData.containsParam("lat")) {
			throw new ErrorCodeException(300004, "miss.lat");
		}
		if(!TransData.containsParam("lon")) {
			throw new ErrorCodeException(300005, "miss.lon");
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
		}else {
			String dt = TransData.getValueAsString("date");
			if(dt.indexOf('-') == 0) {
				params.put("ad", -1);
			}
		}
		params.put("zone", TransData.get("zone"));
		params.put("lat", TransData.get("lat"));
		params.put("lon", TransData.get("lon"));
		params.put("hsys", TransData.getValueAsInt("hsys", 0));
		params.put("tradition", false);
		params.put("strongRecption", TransData.getValueAsBool("strongRecption", false));
		params.put("virtualPointReceiveAsp", TransData.getValueAsBool("virtualPointReceiveAsp", false));
		params.put("simpleAsp", TransData.getValueAsBool("simpleAsp", false));
		params.put("predictive", TransData.getValueAsBool("predictive", false));
		params.put("zodiacal", TransData.getValueAsInt("zodiacal", 0));
		if(TransData.containsParam("siderealAyanamsa")) {
			params.put("siderealAyanamsa", TransData.get("siderealAyanamsa"));
		}
		params.put("southchart", TransData.getValueAsBool("southchart", false));
		if(TransData.containsParam("gpsLat")) {
			params.put("gpsLat", TransData.get("gpsLat"));
			params.put("gpsLon", TransData.get("gpsLon"));
		}
		// 量化盘(汉堡学派)WP-0 参数白名单:容许度 / 流派 / 个人点容许度 / 宫框开关。
		// 条件透传(仅前端非默认才下发)→ 缺省走 Python 默认(orb=1.0/school=classic/frames=true)= 现状字节零回归,不扰缓存。
		if(TransData.containsParam("orb")) {
			params.put("orb", TransData.get("orb"));
		}
		if(TransData.containsParam("personalOrb")) {
			params.put("personalOrb", TransData.get("personalOrb"));
		}
		if(TransData.containsParam("school")) {
			params.put("school", TransData.get("school"));
		}
		if(TransData.containsParam("frames")) {
			params.put("frames", TransData.get("frames"));
		}
		// 赤纬接触开关:OFF 时下发 declination=false,Python 省算(缺省 True=现状)。不登记则开关关不掉后端计算。
		if(TransData.containsParam("declination")) {
			params.put("declination", TransData.get("declination"));
		}
		// 严格汉堡因子集(D2):true 时 Python 在 uranian 分支剔黑月/紫气;缺省不发=现状字节零回归。
		if(TransData.containsParam("strictFactors")) {
			params.put("strictFactors", TransData.getValueAsBool("strictFactors", false));
		}
		// 戴维森盘(A5):含第二人出生数据的对象,原样透传给 Python;缺省不发=零回归。
		if(TransData.containsParam("davison")) {
			params.put("davison", TransData.get("davison"));
		}

		return params;
	}
}
