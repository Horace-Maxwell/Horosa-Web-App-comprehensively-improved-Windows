package spacex.astrostudy.controller;


import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.JsonUtility;
import spacex.astrostudy.helper.AstroHelper;

@Controller
@RequestMapping("/predict")
public class PredictiveController {

	private Map<String, Object> getParams(){
		Map<String, Object> params = new HashMap<String, Object>();
		if(!TransData.containsParam("date")) {
			throw new ErrorCodeException(200001, "miss.date");
		}
		if(!TransData.containsParam("time")) {
			throw new ErrorCodeException(200002, "miss.time");
		}
		if(!TransData.containsParam("zone")) {
			throw new ErrorCodeException(200003, "miss.zone");
		}
		if(!TransData.containsParam("lat")) {
			throw new ErrorCodeException(200004, "miss.lat");
		}
		if(!TransData.containsParam("lon")) {
			throw new ErrorCodeException(200005, "miss.lon");
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
		params.put("tradition", TransData.getValueAsBool("tradition", false));
		params.put("predictive", TransData.getValueAsBool("predictive", false));
		params.put("southchart", TransData.getValueAsBool("southchart", false));
		if(TransData.containsParam("pdaspects")) {
			Object aspobj = TransData.get("pdaspects");
			if(aspobj instanceof String) {
				aspobj = JsonUtility.decodeList((String)aspobj, String.class);
			}
			params.put("pdaspects", aspobj);
		}
		if(TransData.containsParam("pdtype")) {
			params.put("pdtype", TransData.get("pdtype"));
		}
		if(TransData.containsParam("startSign")) {
			params.put("startSign", TransData.get("startSign"));
		}
		if(TransData.containsParam("stopLevelIdx")) {
			params.put("stopLevelIdx", TransData.get("stopLevelIdx"));
		}

		params.put("asporb", TransData.getValueAsDouble("asporb", 1));
		params.put("nodeRetrograde", TransData.getValueAsBool("nodeRetrograde", false));
		params.put("datetime", TransData.get("datetime"));
		if(TransData.containsParam("dirLat")) {
			params.put("dirLat", TransData.get("dirLat"));			
		}
		if(TransData.containsParam("dirLon")) {
			params.put("dirLon", TransData.get("dirLon"));
		}
		if(TransData.containsParam("dirZone")) {
			params.put("dirZone", TransData.get("dirZone"));
		}
		if(TransData.containsParam("zodiacal")) {
			params.put("zodiacal", TransData.get("zodiacal"));
		}
		if(TransData.containsParam("virtualPointReceiveAsp")) {
			params.put("virtualPointReceiveAsp", TransData.get("virtualPointReceiveAsp"));
		}
		
		return params;
	}
	
	@ResponseBody
	@RequestMapping("/solararc")
	public void solararc(){
		Map<String, Object> params = getParams();		
		Map<String, Object> res = AstroHelper.getSolarArc(params);		
		TransData.set(res);
	}
	
	@ResponseBody
	@RequestMapping("/solarreturn")
	public void solarreturn(){
		Map<String, Object> params = getParams();		
		Map<String, Object> res = AstroHelper.getSolarReturn(params);		
		TransData.set(res);
	}
	
	@ResponseBody
	@RequestMapping("/lunarreturn")
	public void lunarreturn(){
		Map<String, Object> params = getParams();		
		Map<String, Object> res = AstroHelper.getLunarReturn(params);		
		TransData.set(res);
	}
	
	@ResponseBody
	@RequestMapping("/givenyear")
	public void givenyear(){
		Map<String, Object> params = getParams();		
		Map<String, Object> res = AstroHelper.getGivenYear(params);		
		TransData.set(res);
	}
	
	@ResponseBody
	@RequestMapping("/profection")
	public void profection(){
		Map<String, Object> params = getParams();		
		Map<String, Object> res = AstroHelper.getProfection(params);		
		TransData.set(res);
	}
	
	@ResponseBody
	@RequestMapping("/pd")
	public void pd(){
		Map<String, Object> params = getParams();		
		Map<String, Object> res = AstroHelper.getPrimaryDirection(params);		
		TransData.set(res);
	}
	
	@ResponseBody
	@RequestMapping("/zr")
	public void zr(){
		Map<String, Object> params = getParams();		
		Map<String, Object> res = AstroHelper.getZodiacalRelease(params);		
		TransData.set(res);
	}
	
	@ResponseBody
	@RequestMapping("/dice")
	public void dice(){
		if(!TransData.containsParam("planet")) {
			throw new ErrorCodeException(200006, "miss.planet");
		}
		if(!TransData.containsParam("sign")) {
			throw new ErrorCodeException(200007, "miss.sign");
		}
		if(!TransData.containsParam("house")) {
			throw new ErrorCodeException(200008, "miss.house");
		}
		Map<String, Object> params = getParams();	
		params.put("planet", TransData.get("planet"));
		params.put("sign", TransData.get("sign"));
		params.put("house", TransData.get("house"));

		Map<String, Object> res = AstroHelper.getDice(params);		
		TransData.set(res);
	}
	
	
}
