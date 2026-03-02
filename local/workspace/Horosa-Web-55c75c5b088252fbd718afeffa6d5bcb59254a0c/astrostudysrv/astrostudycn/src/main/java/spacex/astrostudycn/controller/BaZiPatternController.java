package spacex.astrostudycn.controller;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.StringUtility;
import spacex.astrostudy.constants.AstroPrivilege;
import spacex.astrostudy.helper.PrivilegeHelper;
import spacex.astrostudy.model.AstroUser;
import spacex.astrostudycn.helper.BaZiPredictHelper;

@Controller
@RequestMapping("/bazi")
public class BaZiPatternController {
	
	@ResponseBody
	@RequestMapping("/pattern/update")
	public void update(){
		Map<String, Object> params = checkParams();
		String token = TransData.getToken();
		AstroUser user = (AstroUser) PrivilegeHelper.getUser(token);
		if(user == null) {
			throw new ErrorCodeException(2000005, "must.login");
		}
		if(!user.permit(AstroPrivilege.EDIT_BAZI_PATTERN)) {
			throw new ErrorCodeException(2000006, "no.priviliege");
		}
		
		BaZiPredictHelper.save(params);
	}
	
	@ResponseBody
	@RequestMapping("/pattern")
	public void pattern(){
		Map<String, Object> params = checkParams();
		String year = (String) params.get("year");
		String month = (String) params.get("month");
		String date = (String) params.get("date");
		String time = (String) params.get("time");
		
		List<Map> attrs = BaZiPredictHelper.getAttributes();
		Map<String, Object>[] pattern = BaZiPredictHelper.getPattern(year, month, date, time);
		
		TransData.set("Female", pattern[0]);
		TransData.set("Male", pattern[1]);
		TransData.set("Attributes", attrs);
		
		String token = TransData.getToken();
		AstroUser user = (AstroUser) PrivilegeHelper.getUser(token);
		if(user == null) {
			TransData.set("readonly", 1);
		}else {
			if(user.permit(AstroPrivilege.EDIT_BAZI_PATTERN)) {
				TransData.set("readonly", 0);
			}else {
				TransData.set("readonly", 1);
			}
		}
	}
	
	private Map<String, Object> checkParams(){
		String year = TransData.getValueAsString("year");
		String month = TransData.getValueAsString("month");
		String date = TransData.getValueAsString("date");
		String time = TransData.getValueAsString("time");
		if(StringUtility.isNullOrEmpty(year)) {
			throw new ErrorCodeException(2000001, "miss.year.ganzi");
		}
		if(StringUtility.isNullOrEmpty(month)) {
			throw new ErrorCodeException(2000002, "miss.month.ganzi");
		}
		if(StringUtility.isNullOrEmpty(date)) {
			throw new ErrorCodeException(2000003, "miss.date.ganzi");
		}
		if(StringUtility.isNullOrEmpty(time)) {
			throw new ErrorCodeException(2000004, "miss.time.ganzi");
		}
		
		Map<String, Object> params = TransData.getAllRequestParams();
		params.put("year", year);
		params.put("month", month);
		params.put("date", date);
		params.put("time", time);
		
		return params;
		
	}
	
}
