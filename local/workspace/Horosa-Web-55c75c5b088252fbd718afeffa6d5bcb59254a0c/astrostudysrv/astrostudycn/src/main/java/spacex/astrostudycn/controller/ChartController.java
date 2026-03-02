package spacex.astrostudycn.controller;


import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;
import spacex.astrostudy.helper.AstroHelper;
import spacex.astrostudy.helper.NongliHelper;
import spacex.astrostudy.helper.predict.PlanetSignPredictHelper;
import spacex.astrostudycn.model.OnlyFourColumns;

@Controller
public class ChartController {

	@ResponseBody
	@RequestMapping("/chart")
	public void chart(){
		Map<String, Object> params = getParams();
		int ad = ConvertUtility.getValueAsInt(params.get("ad"), 1);
		
		Map<String, Object> res = AstroHelper.getChart(params);
		Map<String, Object> reqparams = (Map<String, Object>) res.get("params");
		if(reqparams != null) {
			reqparams.put("gpsLat", TransData.get("gpsLat"));
			reqparams.put("gpsLon", TransData.get("gpsLon"));	
		}
		
		String zone = TransData.getValueAsString("zone");
		String lon = TransData.getValueAsString("lon");
		String lat = TransData.getValueAsString("lat");
		String dtstr = String.format("%s %s", params.get("date"), params.get("time"));
		boolean after23NewDay = false;
		OnlyFourColumns bz = new OnlyFourColumns(ad, dtstr, zone, lon, lat, after23NewDay);
		Map<String, Object> map = bz.getNongli();
		if(res.containsKey("chart")) {
			Map<String, Object> chart = (Map<String, Object>) res.get("chart");
			bz.genLifeMasterDeg(chart);
			chart.put("nongli", map);
		}else {
			res.put("nongli", map);					
		}
		
		PlanetSignPredictHelper.predictPlanetSign(res);
		
		TransData.set(res);
	}
	
	@ResponseBody
	@RequestMapping("/chart13")
	public void chart13(){
		Map<String, Object> params = getParams();
		int ad = ConvertUtility.getValueAsInt(params.get("ad"), 1);
		
		Map<String, Object> res = AstroHelper.getChart13(params);
		Map<String, Object> reqparams = (Map<String, Object>) res.get("params");
		if(reqparams != null) {
			reqparams.put("gpsLat", TransData.get("gpsLat"));
			reqparams.put("gpsLon", TransData.get("gpsLon"));	
		}
		
		NongliHelper.fillNongli(res, params, ad);
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
		params.put("doubingSu28", TransData.getValueAsBool("doubingSu28", false));
		params.put("strongRecption", TransData.getValueAsBool("strongRecption", false));
		params.put("virtualPointReceiveAsp", TransData.getValueAsBool("virtualPointReceiveAsp", false));
		params.put("simpleAsp", TransData.getValueAsBool("simpleAsp", false));
		params.put("predictive", TransData.getValueAsBool("predictive", true));
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
		if(TransData.containsParam("zodiacal")) {
			params.put("zodiacal", TransData.get("zodiacal"));
		}else {
			params.put("zodiacal", 0);
		}
		if(TransData.containsParam("gpsLat")) {
			params.put("gpsLat", TransData.get("gpsLat"));
			params.put("gpsLon", TransData.get("gpsLon"));
		}
		
		return params;
	}
}
