package spacex.astrostudy.controller;

import java.util.Map;

import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.PropertyPlaceholder;
import boundless.spring.help.interceptor.KeyConstants;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.StringUtility;
import boundless.web.common.IUser;
import spacex.astrostudy.model.AstroUser;
import spacex.astrostudy.service.UserService;

@Controller
@RequestMapping("/user")
public class RegisterController {
	private static String COOKIE_DOMAIN = PropertyPlaceholder.getProperty("web.cookie.domain", "/");
	private static int COOKIE_EXPIRES = PropertyPlaceholder.getPropertyAsInt("web.cookie.expires", 86400);
	
	private static boolean DevMode = PropertyPlaceholder.getPropertyAsBool("devmode", false);
	
	@Autowired
	private UserService service;

	@RequestMapping("/register")
	@ResponseBody
	public void execute(HttpServletRequest request, HttpServletResponse response) {
		String loginid = TransData.getValueAsString("LoginId");
		String pwd = TransData.getValueAsString("Pwd");
		
		if(StringUtility.isNullOrEmpty(loginid)){
			throw new ErrorCodeException(1900, "loginid.is.null", "error", "register");
		}
		if(StringUtility.isNullOrEmpty(pwd)){
			throw new ErrorCodeException(1900, "password.is.null", "error", "register");
		}
		
		TokenController.verifyImageToken(request);
		
		AstroUser user = (AstroUser) service.registerUser(loginid, pwd);
		Map<String, Object> usermap = user.toMap();
		usermap.remove("password");
		usermap.put("pdaspects", user.getPdAspectsSet());

		TransData.set("User", usermap);
		TransData.set("Token", user.getToken());

	}
		
}
