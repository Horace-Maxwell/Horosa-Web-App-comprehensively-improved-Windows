package spacex.astrostudy.controller;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.StringUtility;
import spacex.astrostudy.helper.AstroCacheHelper;
import spacex.astrostudy.helper.PrivilegeHelper;
import spacex.astrostudy.model.AstroUser;

@Controller
@RequestMapping("/usermgmt")
public class UserMgmtController {

	@RequestMapping("/users")
	@ResponseBody
	public void users(){
		String user = TransData.getValueAsString("user");
		Boolean admin = null;
		if(TransData.containsParam("admin")) {
			admin = TransData.getValueAsBool("admin", false);
		}
		Long privi = null;
		if(TransData.containsParam("privilege")) {
			privi = TransData.getValueAsLong("privilege", 0);
		}
		List<Map<String, Object>> list = AstroCacheHelper.getUsers(user, admin, privi);
		if(TransData.hasPagination()) {
			int total = list.size();
			list = TransData.getParties(list);
			TransData.set("List", list);
			TransData.set("Total", total);
		}else {
			TransData.set(list);			
		}
	}
	
	@RequestMapping("/charts")
	@ResponseBody
	public void charts(){
		String user = TransData.getValueAsString("user");
		String tag = TransData.getValueAsString("tag");
		List<Map<String, Object>> list = AstroCacheHelper.getChartsByCreator(tag, user);
		if(TransData.hasPagination()) {
			int total = list.size();
			list = TransData.getParties(list);
			TransData.set("List", list);
			TransData.set("Total", total);
		}else {
			TransData.set(list);			
		}
	}
	

	@RequestMapping("/setprivi")
	@ResponseBody
	public void setPrivilege() {
		String uid = TransData.getValueAsString("user");
		if(StringUtility.isNullOrEmpty(uid)) {
			throw new ErrorCodeException(8000001, "miss.userid");
		}
		
		long privi = TransData.getValueAsInt("privilege", 0);
		AstroUser user = AstroCacheHelper.getUser(uid);
		user.setPrivilege(privi);
		
		PrivilegeHelper.saveUser(user);		
	}
	
	@RequestMapping("/setupadmin")
	@ResponseBody
	public void setupAdmin() {
		String uid = TransData.getValueAsString("user");
		if(StringUtility.isNullOrEmpty(uid)) {
			throw new ErrorCodeException(8000001, "miss.userid");
		}
		boolean flag = TransData.getValueAsBool("admin", false);
				
		if(!AstroCacheHelper.isSuperAdmin(uid)) {
			AstroUser user = AstroCacheHelper.getUser(uid);
			user.setAdmin(flag);
			
			PrivilegeHelper.saveUser(user);			
		}
		
	}
	
}
