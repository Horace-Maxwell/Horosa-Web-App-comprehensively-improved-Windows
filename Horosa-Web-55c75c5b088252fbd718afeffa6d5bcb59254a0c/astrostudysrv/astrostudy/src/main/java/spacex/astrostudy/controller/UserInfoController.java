package spacex.astrostudy.controller;

import java.util.Collection;
import java.util.List;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.StringUtility;
import boundless.web.common.IUser;
import spacex.astrostudy.helper.PrivilegeHelper;
import spacex.astrostudy.model.AstroUser;
import spacex.astrostudy.service.UserService;

@Controller
@RequestMapping("/user")
public class UserInfoController {
	
	@Autowired
	private UserService service;

	@RequestMapping("/changepwd")
	@ResponseBody
	public void changePwd() {
		if(!TransData.containsParam("OldPwd")) {
			throw new ErrorCodeException(110001, "miss.oldpwd");
		}
		if(!TransData.containsParam("NewPwd")) {
			throw new ErrorCodeException(110001, "miss.newpwd");
		}
		IUser user = TransData.getCurrentUser();
		String oldpwd = TransData.getValueAsString("OldPwd");
		String hashpwd = PrivilegeHelper.getPwdHash(oldpwd);
		if(!hashpwd.equalsIgnoreCase(user.getPassword())) {
			throw new ErrorCodeException(110001, "pwd.error");
		}
		
		String newpwd = TransData.getValueAsString("NewPwd");
		String newhashpwd = PrivilegeHelper.getPwdHash(newpwd);
		user.setPassword(newhashpwd);
		service.saveUser(user);
	}
	
	@RequestMapping("/changeparams")
	@ResponseBody
	public void changeParams() {
		AstroUser user = (AstroUser)TransData.getCurrentUser();
		
		if(TransData.containsParam("lat")) {
			user.setLat(TransData.getValueAsString("lat"));
		}
		if(TransData.containsParam("lon")) {
			user.setLon(TransData.getValueAsString("lon"));
		}
		if(TransData.containsParam("gpsLat")) {
			user.gpsLat = TransData.getValueAsDouble("gpsLat");
		}
		if(TransData.containsParam("gpsLon")) {
			user.gpsLon = TransData.getValueAsDouble("gpsLon");
		}
		if(TransData.containsParam("hsys")) {
			user.setHsys(TransData.getValueAsInt("hsys"));
		}
		if(TransData.containsParam("zodiacal")) {
			user.setZodiacal(TransData.getValueAsByte("zodiacal"));
		}
		if(TransData.containsParam("tradition")) {
			user.setTradition(TransData.getValueAsByte("tradition", (byte)1));
		}
		if(TransData.containsParam("pdtype")) {
			user.setPdtype(TransData.getValueAsByte("pdtype", (byte)1));
		}
		if(TransData.containsParam("strongRecption")) {
			user.setStrongReception(TransData.getValueAsByte("strongRecption", (byte)0));
		}
		if(TransData.containsParam("virtualPointReceiveAsp")) {
			user.setVirtualPntReceiveAsp(TransData.getValueAsByte("virtualPointReceiveAsp", (byte)1));
		}
		if(TransData.containsParam("simpleAsp")) {
			user.setSimpleAsp(TransData.getValueAsByte("simpleAsp", (byte)0));
		}		
		if(TransData.containsParam("doubingSu28")) {
			user.setDoubingSu28(TransData.getValueAsByte("doubingSu28", (byte)0));
		}		
		if(TransData.containsParam("predictive")) {
			user.setPredictive(TransData.getValueAsByte("predictive", (byte)1));
		}
		if(TransData.containsParam("pdaspects")) {
			Object obj = TransData.get("pdaspects");
			if(obj instanceof Collection) {
				String asp = StringUtility.joinWithSeperator(",", obj);
				user.setPdaspects(asp);
			}else {
				user.setPdaspects((String)obj);
			}			
		}
		if(TransData.containsParam("ad")) {
			int ad = TransData.getValueAsInt("ad", 1);
			user.setAd(ad);
		}
		
		service.saveUser(user);
	}
	
}
