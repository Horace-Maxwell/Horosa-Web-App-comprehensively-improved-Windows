package spacex.astrostudy.controller;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.spring.help.interceptor.TransData;
import boundless.types.ICache;
import boundless.utility.CalculatePool;
import boundless.utility.ConvertUtility;
import boundless.utility.SerialCalculatePool;
import boundless.utility.StringUtility;
import boundless.web.common.IUser;
import spacex.astrostudy.helper.AstroCacheHelper;
import spacex.astrostudy.helper.PrivilegeHelper;
import spacex.astrostudy.model.AstroUser;
import spacex.astrostudy.service.UserService;

@Controller
@RequestMapping("/user")
public class UserCheckLoginController {
	
	@Autowired
	private UserService service;

	@RequestMapping("/check")
	@ResponseBody
	public void execute(HttpServletRequest request, HttpServletResponse response){
		String token = TransData.getToken();
		if(token != null) {
			AstroUser user = (AstroUser)PrivilegeHelper.getUser(token);
			if(user != null) {
				List<Map<String, Object>> charts = AstroCacheHelper.getChartsByCreator(user.getLoginId());
				treatTags(charts, user);
				Map<String, Object> usermap = user.toMap();
				usermap.remove("password");
				usermap.put("pdaspects", user.getPdAspectsSet());
				
				TransData.set("User", usermap);
				TransData.set("Token", user.getToken());
				TransData.set("Charts", charts);
				if(TransData.hasPagination()) {
					int total = charts.size();
					charts = TransData.getParties(charts);
					TransData.set("Charts", charts);
					TransData.set("ChartsTotal", total);
				}
				
				boolean admin = user.isAdmin() || AstroCacheHelper.isSuperAdmin(user.getLoginId());
				user.setAdmin(admin);
				TransData.set("IsAdmin", admin);
				SerialCalculatePool.queueUserWorkItem(()->{
					service.saveUser(user);
				});
			}
		}
	}
	
	private void treatTags(List<Map<String, Object>> charts, AstroUser user) {
		Set<String> tags = new HashSet<String>();
		for(Map<String, Object> map : charts) {
			String str = (String)map.get("tags");
			if(!StringUtility.isNullOrEmpty(str)) {
				Set<String> set = StringUtility.splitToStringSet(str, ',');
				tags.addAll(set);				
			}
		}
		user.setGroup(tags);
	}
	
}
