package spacex.astrostudy.interceptor;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.springframework.web.servlet.HandlerInterceptor;

import boundless.exception.ErrorCodeException;
import boundless.exception.NeedLoginException;
import boundless.io.FileUtility;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;
import boundless.web.common.IUser;
import spacex.astrostudy.helper.PrivilegeHelper;
import boundless.web.common.BaseUser;

public class UserTokenInterceptor implements HandlerInterceptor {
	private static Set<String> needLogin = new HashSet<String>();
	private static boolean needCheck = true;
	private static Map<String, Map<String, Object>> superToken = new HashMap<String, Map<String, Object>>();
	
	static {
		String json = FileUtility.getStringFromClassPath("data/tokentrans.json");
		Map<String, Object> map = JsonUtility.toDictionary(json);
		needCheck = ConvertUtility.getValueAsBool(map.get("needCheck"), true);
		
		Map<String, Map<String, Object>> supertkmap = (Map<String, Map<String, Object>>) map.get("superToken");
		if(supertkmap != null) {
			for(Map.Entry<String, Map<String, Object>> entry : supertkmap.entrySet()) {
				String key = entry.getKey();
				Map<String, Object> tkmap = entry.getValue();
				superToken.put(key, tkmap);
				superToken.put(key.toLowerCase(), tkmap);
			}
		}
		
		List<String> trans = (List<String>) map.get("needlogin");
		for(String transcode : trans) {
			needLogin.add(transcode);
		}
		
	}

	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
		if(!needCheck) {
			return true;
		}
		
		IUser user = null;
		String transcode = TransData.getTransCode();
		String token = TransData.getToken();
		if(!StringUtility.isNullOrEmpty(token)) {
			if(superToken.containsKey(token)) {
				Map<String, Object> info = superToken.get(token);
				long seq = ConvertUtility.getValueAsLong(info.get("seq"));
				String userId = (String) info.get("userId");
				IUser obj = new BaseUser(seq, userId);
				TransData.setCurrentUser(obj);	
				return true;
			}
			
			user = PrivilegeHelper.getUser(token);
			if(user != null){
				TransData.setCurrentUser(user);
			}
		}
		if(needLogin.contains(transcode)) {
			if(user == null) {
				throw new NeedLoginException("need.login");
			}
		}

		return true;
	}

}
