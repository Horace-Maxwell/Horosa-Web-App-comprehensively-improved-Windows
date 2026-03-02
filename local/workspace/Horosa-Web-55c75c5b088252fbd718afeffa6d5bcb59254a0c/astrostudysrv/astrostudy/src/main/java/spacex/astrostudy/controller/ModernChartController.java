package spacex.astrostudy.controller;

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
@RequestMapping("/modern")
public class ModernChartController {
	@ResponseBody
	@RequestMapping("/relative")
	public void chart(){
		Map<String, Object> params = getParams();
		
		Map<String, Object> res = AstroHelper.getRelativeChart(params);
		Map<String, Object> reqparams = (Map<String, Object>) res.get("params");
		if(reqparams != null) {
			reqparams.put("gpsLat", TransData.get("gpsLat"));
			reqparams.put("gpsLon", TransData.get("gpsLon"));	
		}
		
		TransData.set(res);
	}
	
	private Map<String, Object> getParams(){
		Map<String, Object> params = new HashMap<String, Object>();
		if(!TransData.containsParam("inner")) {
			throw new ErrorCodeException(300001, "miss.innerdata");
		}
		if(!TransData.containsParam("outer")) {
			throw new ErrorCodeException(300002, "miss.outerdata");
		}
		Map<String, Object> inner = (Map<String, Object>)TransData.get("inner");
		Map<String, Object> outer = (Map<String, Object>)TransData.get("outer");
		if(!inner.containsKey("date")) {
			throw new ErrorCodeException(310001, "miss.inner.date");
		}
		if(!inner.containsKey("time")) {
			throw new ErrorCodeException(310002, "miss.inner.time");
		}
		if(!inner.containsKey("zone")) {
			throw new ErrorCodeException(310003, "miss.inner.zone");
		}
		if(!inner.containsKey("lat")) {
			throw new ErrorCodeException(310004, "miss.inner.lat");
		}
		if(!inner.containsKey("lon")) {
			throw new ErrorCodeException(320005, "miss.inner.lon");
		}
		if(!outer.containsKey("date")) {
			throw new ErrorCodeException(320001, "miss.outer.date");
		}
		if(!outer.containsKey("time")) {
			throw new ErrorCodeException(320002, "miss.outer.time");
		}
		if(!outer.containsKey("zone")) {
			throw new ErrorCodeException(320003, "miss.outer.zone");
		}
		if(!outer.containsKey("lat")) {
			throw new ErrorCodeException(320004, "miss.outer.lat");
		}
		if(!outer.containsKey("lon")) {
			throw new ErrorCodeException(320005, "miss.outer.lon");
		}
		
		int ad = ConvertUtility.getValueAsInt(inner.get("ad"), 1);
		inner.put("ad", ad);
		if(ad != 1) {
			String dt = ConvertUtility.getValueAsString(inner.get("date"));
			if(dt.indexOf('-') != 0) {
				inner.put("date", "-" + dt);
			}
		}
		ad = ConvertUtility.getValueAsInt(outer.get("ad"), 1);
		outer.put("ad", ad);
		if(ad != 1) {
			String dt = ConvertUtility.getValueAsString(outer.get("date"));
			if(dt.indexOf('-') != 0) {
				outer.put("date", "-" + dt);
			}
		}
		
		
		params.put("inner", inner);
		params.put("outer", outer);
		params.put("hsys", TransData.getValueAsInt("hsys", 0));
		params.put("zodiacal", TransData.getValueAsInt("zodiacal", 0));
		params.put("relative", TransData.getValueAsInt("relative", 0));
		
		return params;
	}

}
