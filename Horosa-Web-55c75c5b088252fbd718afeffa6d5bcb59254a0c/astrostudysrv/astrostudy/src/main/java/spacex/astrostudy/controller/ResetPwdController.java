package spacex.astrostudy.controller;

import javax.servlet.http.HttpServletRequest;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.RandomUtility;
import boundless.utility.StringUtility;
import boundless.web.common.IUser;
import spacex.astrostudy.helper.AstroCacheHelper;
import spacex.astrostudy.helper.PrivilegeHelper;
import spacex.astrostudy.model.AstroUser;
import spacex.astrostudy.service.UserService;
import spacex.basecomm.helper.NotificationHelper;

@Controller
@RequestMapping("/user")
public class ResetPwdController {
	@Autowired
	private UserService service;

	
	@RequestMapping("/resetpwd")
	@ResponseBody
	public void resetPwd(HttpServletRequest request) {
		TokenController.verifyImageToken(request);
		if(!TransData.containsParam("LoginId")) {
			throw new ErrorCodeException(100101, "miss.loginid");
		}
		String loginid = TransData.getValueAsString("LoginId");
		if(!StringUtility.isEmail(loginid)) {
			throw new ErrorCodeException(100102, "loginid.not.emailform");
		}
		AstroUser user = AstroCacheHelper.getUser(loginid);
		if(user == null) {
			throw new ErrorCodeException(100102, "user.not.exist");
		}
		String pwd = RandomUtility.randomString(6);
		String subject = "重置后的新密码";
		String msg = String.format("重置后的新密码：%s  \n请尽快修改密码。【astrostudy】", pwd);
		
		String hashpwd = PrivilegeHelper.getPwdHash(pwd);
		user.setPassword(hashpwd);
		service.saveUser(user);
		
		NotificationHelper.sendEmail(subject, msg, loginid);	
	}
	

}
