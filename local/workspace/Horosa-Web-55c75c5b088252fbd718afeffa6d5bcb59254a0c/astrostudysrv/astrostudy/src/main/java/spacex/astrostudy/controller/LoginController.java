package spacex.astrostudy.controller;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;


import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.CalculatePool;
import boundless.utility.StringUtility;
import boundless.web.common.IUser;
import spacex.astrostudy.helper.AstroCacheHelper;
import spacex.astrostudy.helper.PrivilegeHelper;
import spacex.astrostudy.model.AstroUser;
import spacex.astrostudy.service.UserService;

@Controller
@RequestMapping("/user")
public class LoginController {
	
	@Autowired
	private UserService service;

	@RequestMapping("/login")
	@ResponseBody
	public void execute(){
		String loginid = TransData.getValueAsString("LoginId");
		String pwd = TransData.getValueAsString("Pwd");
		
		if(StringUtility.isNullOrEmpty(loginid)){
			throw new ErrorCodeException(1900, "loginid.is.null", "error", "login");
		}
		if(StringUtility.isNullOrEmpty(pwd)){
			throw new ErrorCodeException(1900, "password.is.null", "error", "login");
		}
		
		Map<String, Object> map = service.loginUser(loginid, pwd);
		AstroUser user = (AstroUser) map.get("User");		
		TransData.setCurrentUser(user);
		
		Map<String, Object> usermap = user.toMap();
		usermap.remove("password");
		usermap.put("pdaspects", user.getPdAspectsSet());
		
		TransData.set("User", usermap);
		TransData.set("Token", user.getToken());
		
		List<Map<String, Object>> charts = (List<Map<String, Object>>) map.get("Charts");
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
	}


	@RequestMapping("/logout")
	@ResponseBody
	public void logout(){
		IUser user = TransData.getCurrentUser();
		if(user == null){
			return;
		}

		CalculatePool.queueUserWorkItem(()->{
			PrivilegeHelper.clearToken(user.getToken());
		});
	}
	
	
}
