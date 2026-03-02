package spacex.astrostudy.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.DateTimeUtility;
import boundless.utility.StringUtility;
import spacex.astrostudy.helper.JdnHelper;

@Controller
@RequestMapping("/jdn")
public class JdnController {

	@ResponseBody
	@RequestMapping("/date")
	public void date(){
		if(!TransData.containsParam("jdn")) {
			throw new ErrorCodeException(110001, "miss.jdn");
		}
		if(!TransData.containsParam("zone")) {
			throw new ErrorCodeException(110002, "miss.zone");
		}
		
		double jdn = TransData.getValueAsDouble("jdn");
		String zone = (String)TransData.get("zone");
		String str = JdnHelper.getDateFromJdn(jdn, zone);
		
		TransData.set("date", str);
	}
	

	@ResponseBody
	@RequestMapping("/num")
	public void num(){
		if(!TransData.containsParam("date")) {
			throw new ErrorCodeException(120001, "miss.date");
		}
		if(!TransData.containsParam("zone")) {
			throw new ErrorCodeException(120002, "miss.zone");
		}
		
		String tm = TransData.getValueAsString("time");
		if(StringUtility.isNullOrEmpty("tm")) {
			tm = "12:00:00";
		}
		String date = (String)TransData.get("date");
		String[] parts = StringUtility.splitString(date, ' ');
		if(parts.length == 1) {
			date = String.format("%s %s", date, tm);
		}
		
		String zone = (String)TransData.get("zone");
		double jdn = DateTimeUtility.getDateNum(date, zone);
		
		TransData.set("jdn", jdn);
	}
	

	
}
