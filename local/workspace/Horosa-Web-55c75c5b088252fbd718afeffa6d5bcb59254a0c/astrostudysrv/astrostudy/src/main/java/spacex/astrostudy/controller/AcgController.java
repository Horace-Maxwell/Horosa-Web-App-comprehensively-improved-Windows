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
@RequestMapping("/location")
public class AcgController {

	@ResponseBody
	@RequestMapping("/acg")
	public void chart(){
		Map<String, Object> params = getParams();
		Map<String, Object> res = AstroHelper.getAcg(params);

		TransData.set(res);
	}

	@ResponseBody
	@RequestMapping("/acgevent")
	public void acgevent(){
		// 世运事件时刻查找(kind/direction/fromDate)——与出生数据无关,独立轻请求
		Map<String, Object> params = new HashMap<String, Object>();
		if(TransData.containsParam("kind")) {
			params.put("kind", TransData.get("kind"));
		}
		if(TransData.containsParam("direction")) {
			params.put("direction", TransData.get("direction"));
		}
		if(TransData.containsParam("fromDate")) {
			params.put("fromDate", TransData.get("fromDate"));
		}
		Map<String, Object> res = AstroHelper.getAcgEvent(params);

		TransData.set(res);
	}

	@ResponseBody
	@RequestMapping("/acgpoint")
	public void acgpoint(){
		Map<String, Object> params = getParams();
		if(!TransData.containsParam("clickLat")) {
			throw new ErrorCodeException(120006, "miss.clickLat");
		}
		if(!TransData.containsParam("clickLon")) {
			throw new ErrorCodeException(120007, "miss.clickLon");
		}
		params.put("clickLat", TransData.get("clickLat"));
		params.put("clickLon", TransData.get("clickLon"));
		if(TransData.containsParam("orb")) {
			params.put("orb", TransData.get("orb"));
		}
		if(TransData.containsParam("hsys")) {
			params.put("hsys", TransData.get("hsys"));
		}
		Map<String, Object> res = AstroHelper.getAcgPoint(params);

		TransData.set(res);
	}

	private Map<String, Object> getParams(){
		Map<String, Object> params = new HashMap<String, Object>();
		if(!TransData.containsParam("date")) {
			throw new ErrorCodeException(120001, "miss.date");
		}
		if(!TransData.containsParam("time")) {
			throw new ErrorCodeException(120002, "miss.time");
		}
		if(!TransData.containsParam("zone")) {
			throw new ErrorCodeException(120003, "miss.zone");
		}
		if(!TransData.containsParam("lat")) {
			throw new ErrorCodeException(120004, "miss.lat");
		}
		if(!TransData.containsParam("lon")) {
			throw new ErrorCodeException(120005, "miss.lon");
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
		// 占星地图口径开关(默认由 Python 侧兜底=现状,零回归)
		if(TransData.containsParam("mode")) {
			params.put("mode", TransData.get("mode"));
		}
		if(TransData.containsParam("lsMode")) {
			params.put("lsMode", TransData.get("lsMode"));
		}
		if(TransData.containsParam("geodetic")) {
			params.put("geodetic", TransData.get("geodetic"));
		}
		if(TransData.containsParam("geodeticVar")) {
			params.put("geodeticVar", TransData.get("geodeticVar"));
		}
		if(TransData.containsParam("cuspLines")) {
			params.put("cuspLines", TransData.get("cuspLines"));
		}
		if(TransData.containsParam("hsys")) {
			params.put("hsys", TransData.get("hsys"));
		}
		if(TransData.containsParam("coord")) {
			params.put("coord", TransData.get("coord"));
		}
		// 全流派补齐新键(P0/P1/P3):未登记=静默丢弃;Python 侧全部有默认兜底=零回归。
		if(TransData.containsParam("asteroids")) {
			params.put("asteroids", TransData.get("asteroids"));
		}
		if(TransData.containsParam("nodeType")) {
			params.put("nodeType", TransData.get("nodeType"));
		}
		if(TransData.containsParam("lilithType")) {
			params.put("lilithType", TransData.get("lilithType"));
		}
		if(TransData.containsParam("posType")) {
			params.put("posType", TransData.get("posType"));
		}
		if(TransData.containsParam("horizon")) {
			params.put("horizon", TransData.get("horizon"));
		}
		if(TransData.containsParam("draconic")) {
			params.put("draconic", TransData.get("draconic"));
		}
		if(TransData.containsParam("harmonic")) {
			params.put("harmonic", TransData.get("harmonic"));
		}
		if(TransData.containsParam("vibration")) {
			params.put("vibration", TransData.get("vibration"));
		}
		if(TransData.containsParam("lotsCustom")) {
			params.put("lotsCustom", TransData.get("lotsCustom"));
		}
		if(TransData.containsParam("midpointMode")) {
			params.put("midpointMode", TransData.get("midpointMode"));
		}
		if(TransData.containsParam("geodeticZero")) {
			params.put("geodeticZero", TransData.get("geodeticZero"));
		}
		if(TransData.containsParam("ayanamsa")) {
			params.put("ayanamsa", TransData.get("ayanamsa"));
		}
		if(TransData.containsParam("stars")) {
			params.put("stars", TransData.get("stars"));
		}
		if(TransData.containsParam("ccgDate")) {
			params.put("ccgDate", TransData.get("ccgDate"));
		}
		if(TransData.containsParam("ccgTime")) {
			params.put("ccgTime", TransData.get("ccgTime"));
		}
		if(TransData.containsParam("ccgMix")) {
			params.put("ccgMix", TransData.get("ccgMix"));
		}
		// 关系盘(davison/composite/synastry)+ B 盘出生数据
		if(TransData.containsParam("relMode")) {
			params.put("relMode", TransData.get("relMode"));
		}
		if(TransData.containsParam("relDate")) {
			params.put("relDate", TransData.get("relDate"));
		}
		if(TransData.containsParam("relTime")) {
			params.put("relTime", TransData.get("relTime"));
		}
		if(TransData.containsParam("relZone")) {
			params.put("relZone", TransData.get("relZone"));
		}
		if(TransData.containsParam("relLat")) {
			params.put("relLat", TransData.get("relLat"));
		}
		if(TransData.containsParam("relLon")) {
			params.put("relLon", TransData.get("relLon"));
		}

		return params;
	}
	
}
