package spacex.basecomm.controller;

import java.util.Calendar;
import java.util.Date;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.console.Diagnostic;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.FormatUtility;

@Controller
@RequestMapping("/common")
public class SystemController {

	@RequestMapping("/time")
	@ResponseBody
	public long time(HttpServletRequest request, HttpServletResponse response){
		return System.currentTimeMillis();
	}
	
	@RequestMapping("/tm")
	@ResponseBody
	public void timeJson(HttpServletRequest request, HttpServletResponse response){
		TransData.set("Time", System.currentTimeMillis());
	}
	
	@RequestMapping("/tmdetail")
	@ResponseBody
	public void timeDetail(HttpServletRequest request, HttpServletResponse response){
		Calendar cal = Calendar.getInstance();
		
		TransData.set("Year", cal.get(Calendar.YEAR));
		TransData.set("Month", cal.get(Calendar.MONTH));
		TransData.set("Day", cal.get(Calendar.DAY_OF_MONTH));
		TransData.set("Hour", cal.get(Calendar.HOUR_OF_DAY));
		TransData.set("Minute", cal.get(Calendar.MINUTE));
		TransData.set("Second", cal.get(Calendar.SECOND));
		TransData.set("Milli", cal.get(Calendar.MILLISECOND));
		TransData.set("WeekDay", cal.get(Calendar.DAY_OF_WEEK));
	}
	
	@RequestMapping("/hostid")
	@ResponseBody
	public void hostid(){
		TransData.set("HostId", Diagnostic.getHostId());
	}
	
	@RequestMapping("/hid")
	@ResponseBody
	public String simplehostid(){
		return Diagnostic.getHostId();
	}
	
	@RequestMapping("/hidmd5")
	@ResponseBody
	public String simplehostidMD5(){
		return Diagnostic.getHostIdWithMD5();
	}
	
	@RequestMapping("/ver")
	@ResponseBody
	public String version(){
		String groupid = TransData.getValueAsString("groupid");
		String artifactid = TransData.getValueAsString("artifactid");
		return Diagnostic.getMavenVersion(groupid, artifactid);
	}
	
	@RequestMapping("/prevmonth")
	@ResponseBody
	public String prevmonth(){
		Calendar cal = Calendar.getInstance();
		cal.add(Calendar.MONTH, -1);
		Date dt = cal.getTime();
		String res = FormatUtility.formatDateTime(dt, "yyyy-MM");
		return res;
	}
	
}
