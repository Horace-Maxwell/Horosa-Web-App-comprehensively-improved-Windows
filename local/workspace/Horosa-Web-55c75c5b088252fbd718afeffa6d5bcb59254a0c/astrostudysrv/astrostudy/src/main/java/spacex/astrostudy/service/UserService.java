package spacex.astrostudy.service;


import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import boundless.exception.ErrorCodeException;
import boundless.exception.UserExistException;
import boundless.types.ICache;
import boundless.web.common.IUser;
import spacex.astrostudy.helper.AstroCacheHelper;
import spacex.astrostudy.helper.PrivilegeHelper;
import spacex.astrostudy.model.AstroUser;

@Service
public class UserService {

	synchronized public IUser registerUser(String loginId, String pwd) {
		String hashpwd = PrivilegeHelper.getPwdHash(pwd);
		ICache cache = AstroCacheHelper.getUserCache();
		AstroUser user = AstroCacheHelper.getUser(loginId, hashpwd);
		if(user != null) {
			throw new UserExistException();
		}
		
		user = new AstroUser();
		user.setLoginId(loginId);
		user.setPassword(hashpwd);
		
		cache.setMap(loginId, user.toMap());
		PrivilegeHelper.cacheUser(user);
		
		return user;
	}
	
	public Map<String, Object> loginUser(String loginId, String pwd) {
		String hashpwd = PrivilegeHelper.getPwdHash(pwd);
		AstroUser user = AstroCacheHelper.getUser(loginId, hashpwd);
		if(user == null) {
			throw new ErrorCodeException(1900, "pwd.error", "error", "login");
		}
		
		List<Map<String, Object>> charts = AstroCacheHelper.getChartsByCreator(loginId);
		PrivilegeHelper.cacheUser(user);
		
		Map<String, Object> res = new HashMap<String, Object>();
		res.put("User", user);
		res.put("Charts", charts);
		
		return res;
	}
	
	public List<Map<String, Object>> getUserCharts(IUser user){
		String loginId = user.getLoginId();
		List<Map<String, Object>> charts = AstroCacheHelper.getChartsByCreator(loginId);
		return charts;
	}
	
	public List<Map<String, Object>> getUserCharts(IUser user, String tag){
		String loginId = user.getLoginId();
		List<Map<String, Object>> charts = AstroCacheHelper.getChartsByCreator(tag, loginId);
		return charts;
	}
	
	public void saveUser(IUser user) {
		ICache cache = AstroCacheHelper.getUserCache();
		cache.setMap(user.getLoginId(), user.toMap());
	}
	
}
