package spacex.astrostudy.controller;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import boundless.types.Tuple;
import boundless.utility.FormulaUtility;
import boundless.utility.StringUtility;
import spacex.astrostudy.helper.AstroCacheHelper;
import spacex.astrostudy.helper.AstroHelper;
import spacex.astrostudy.helper.CacheHelper;

@Controller
@RequestMapping("/calc")
public class CalcController {

	@RequestMapping("/azimuth")
	@ResponseBody
	public void azimuth(){
		double jdn = TransData.getValueAsDouble("jdn", Double.NaN);
		double lat = TransData.getValueAsDouble("lat", Double.NaN);
		double lon = TransData.getValueAsDouble("lon", Double.NaN);
		double height = TransData.getValueAsDouble("height", Double.NaN);
		double temp = TransData.getValueAsDouble("temp", Double.NaN);
		double press = TransData.getValueAsDouble("press", Double.NaN);
		double coordLat = TransData.getValueAsDouble("coordLat", Double.NaN);
		double coordLon = TransData.getValueAsDouble("coordLon", Double.NaN);
		int coordType = TransData.getValueAsInt("coordType", 0);
		
		Map<String, Object> params = new HashMap<String, Object>();
		if(jdn == Double.NaN || lat == Double.NaN || lon == Double.NaN || height == Double.NaN || temp == Double.NaN
				 || press == Double.NaN || coordLat == Double.NaN || coordLon == Double.NaN) {
			throw new ErrorCodeException(320001, "params.error");
		}
		params.put("jdn", jdn);
		params.put("lat", lat);
		params.put("lon", lon);
		params.put("height", height);
		params.put("temp", temp);
		params.put("press", press);
		params.put("coordLat", coordLat);
		params.put("coordLon", coordLon);
		params.put("coordType", coordType);
		
		Map<String, Object> res = AstroHelper.getAzimuth(params);
		
		TransData.set(res);
	}
	
	@RequestMapping("/cotrans")
	@ResponseBody
	public void cotrans(){
		double lat = TransData.getValueAsDouble("lat", Double.NaN);
		double lon = TransData.getValueAsDouble("lon", Double.NaN);
		int type = TransData.getValueAsInt("type", -1);
		
		Map<String, Object> params = new HashMap<String, Object>();
		if(lat == Double.NaN || lon == Double.NaN) {
			throw new ErrorCodeException(320002, "params.error");
		}
		params.put("lat", lat);
		params.put("lon", lon);
		params.put("type", type);
		
		Map<String, Object> res = AstroHelper.getCotrans(params);
		
		TransData.set(res);
	}
	
	@RequestMapping("/formula")
	@ResponseBody
	public void formula() {
		List<Map<String, Object>> list = FormulaUtility.getHelp();
		TransData.set("formula", list);
	}
	
	@RequestMapping("/calculate")
	@ResponseBody
	public void calculate() {
		String expression = TransData.getValueAsString("expression");
		if(StringUtility.isNullOrEmpty(expression)) {
			throw new ErrorCodeException("miss.expression");
		}
		
		String vars = TransData.getValueAsString("vars");
		Tuple<String, String>[] args = FormulaUtility.getArgs(vars);

		double res = FormulaUtility.calculate(expression, args);			
		
		TransData.set("value", res);
	}
	
}
