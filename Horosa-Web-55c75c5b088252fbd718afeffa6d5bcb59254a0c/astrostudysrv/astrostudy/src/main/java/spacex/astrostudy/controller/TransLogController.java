package spacex.astrostudy.controller;

import java.util.Date;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.spring.help.TransLogMongoHelper;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.FormatUtility;
import boundless.utility.StringUtility;

@Controller
@RequestMapping("/log")
public class TransLogController {

	@RequestMapping("/20001")
	@ResponseBody
	public void qryLog(){
		String user = TransData.getValueAsString("User");
		Object[] userseq = new Object[0];
		if(!StringUtility.isNullOrEmpty(user)) {
			userseq = StringUtility.splitString(user, ',');
		}
		
		String toTime = TransData.getValueAsString("ToTime");
		Date dt = FormatUtility.parseDateTime(toTime, "yyyy-MM-dd HH:mm:ss");
		
		String transcodes = TransData.getValueAsString("TransCodes");
		long totm = dt.getTime();
		String[] trans = StringUtility.splitString(transcodes, ',');

		int limit = TransData.getPageSize();
		if(TransData.containsParam("Limit")) {
			limit = TransData.getValueAsInt("Limit");
		}
		List<Map<String, Object>> list;
		boolean needCount = TransData.getValueAsBool("NeedCount", false);
		long total = -1;
		if(needCount){
			String stTime = TransData.getValueAsString("StartTime");
			Date stdt = FormatUtility.parseDateTime(stTime, "yyyy-MM-dd HH:mm:ss");
			long sttm = stdt.getTime();
			total = TransLogMongoHelper.countUserTransLogs(sttm, totm, trans, userseq);
			list = TransLogMongoHelper.findUserTransLogs(limit, sttm, totm, trans, userseq);
		}else {
			list = TransLogMongoHelper.findUserTransLogs(limit, totm, trans, userseq);
		}
		
		list = TransData.getParties(list);
		TransData.set("TransLogs", list);
		TransData.set("Total", total);
		
		
	}
	
	@RequestMapping("/20002")
	@ResponseBody
	public void logTransCodes(){
		List<Map> list = TransLogMongoHelper.getLogQryTransCodes();
		TransData.set("TransCode", list);
	}
	
}
