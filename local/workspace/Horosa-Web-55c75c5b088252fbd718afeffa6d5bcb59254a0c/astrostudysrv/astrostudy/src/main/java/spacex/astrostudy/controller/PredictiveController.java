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
		// Bust legacy local/runtime cache entries after PD method/time-key response wiring changes.
		params.put("_wireRev", "pd_method_sync_v12");
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
		if(TransData.containsParam("pdMethod")) {
			params.put("pdMethod", TransData.get("pdMethod"));
		}
		if(TransData.containsParam("pdTimeKey")) {
			params.put("pdTimeKey", TransData.get("pdTimeKey"));
		}
		// 主限法 v10 进阶开关:顺向(direct)/逆向(converse) 可同选 + 映点 + 界。
		// 必须透传给 Python compute,否则「推运方向/映点/界」选了不生效(选项与显示对不上)。
		if(TransData.containsParam("pdDirect")) {
			params.put("pdDirect", TransData.get("pdDirect"));
		}
		if(TransData.containsParam("pdConverse")) {
			params.put("pdConverse", TransData.get("pdConverse"));
		}
		if(TransData.containsParam("pdAntiscia")) {
			params.put("pdAntiscia", TransData.get("pdAntiscia"));
		}
		if(TransData.containsParam("pdTerms")) {
			params.put("pdTerms", TransData.get("pdTerms"));
		}
		if(TransData.containsParam("pdYears")) {
			params.put("pdYears", TransData.get("pdYears"));
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
		if(TransData.containsParam("siderealAyanamsa")) {
			params.put("siderealAyanamsa", TransData.get("siderealAyanamsa"));
		}
		if(TransData.containsParam("virtualPointReceiveAsp")) {
			params.put("virtualPointReceiveAsp", TransData.get("virtualPointReceiveAsp"));
		}
		if(TransData.containsParam("arcSource")) {
			params.put("arcSource", TransData.get("arcSource"));
		}
		if(TransData.containsParam("rateKey")) {
			params.put("rateKey", TransData.get("rateKey"));
		}
		if(TransData.containsParam("direction")) {
			params.put("direction", TransData.get("direction"));
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
	@RequestMapping("/planetaryarc")
	public void planetaryarc(){
		Map<String, Object> params = getParams();
		Map<String, Object> res = AstroHelper.getPlanetaryArc(params);
		TransData.set(res);
	}

	@ResponseBody
	@RequestMapping("/persianchart")
	public void persianchart(){
		Map<String, Object> params = getParams();
		Map<String, Object> res = AstroHelper.getPersianChart(params);
		TransData.set(res);
	}
	
	@ResponseBody
	@RequestMapping("/dist")
	public void dist(){
		Map<String, Object> params = getParams();
		Map<String, Object> res = AstroHelper.getDistribution(params);
		TransData.set(res);
	}

	@ResponseBody
	@RequestMapping("/agepoint")
	public void agepoint(){
		Map<String, Object> params = getParams();
		Map<String, Object> res = AstroHelper.getAgePoint(params);
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
	@RequestMapping("/pdchart")
	public void pdchart(){
		Map<String, Object> params = getParams();
		Map<String, Object> res = AstroHelper.getPrimaryDirectionChart(params);
		TransData.set(res);
	}

	@ResponseBody
	@RequestMapping("/pd3d")
	public void pd3d(){
		Map<String, Object> params = getParams();
		Map<String, Object> res = AstroHelper.getPrimaryDirection3D(params);
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
