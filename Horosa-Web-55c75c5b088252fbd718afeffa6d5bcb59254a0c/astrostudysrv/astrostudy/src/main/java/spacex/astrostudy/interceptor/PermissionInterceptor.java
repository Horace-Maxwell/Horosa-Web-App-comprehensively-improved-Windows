package spacex.astrostudy.interceptor;


import java.util.HashMap;
import java.util.Map;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.ModelAndView;

import boundless.exception.AccessDenyException;
import boundless.exception.NeedLoginException;
import boundless.spring.help.interceptor.TransData;
import boundless.types.ICache;
import boundless.utility.CalculatePool;
import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;
import boundless.web.common.IUser;
import boundless.web.help.TransUrlUtility;
import spacex.astrostudy.helper.AstroCacheHelper;
import spacex.astrostudy.helper.PrivilegeHelper;

public class PermissionInterceptor implements HandlerInterceptor {
	
	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
		String path = request.getRequestURI();
		String ctx = request.getServletContext().getContextPath();
		path = path.substring(ctx.length());

		if(path.equals("/") || StringUtility.isNullOrEmpty(path) || TransUrlUtility.isCommonPass(path)){
			return true;
		}
		
		IUser user = TransData.getCurrentUser();
		if(user == null){
			throw new NeedLoginException("need.login");				
		}
		
		if(user.getState() != 0){
			throw new NeedLoginException("userstate.abnormal");
		}
		if(!user.permit(null, path)){
			throw new AccessDenyException("transcode.notpermit");
		}
		
		final IUser tmpuser = user;
		String channel = ConvertUtility.getValueAsString(TransData.getRequestHeader("ClientChannel"));
		String app = ConvertUtility.getValueAsString(TransData.getRequestHeader("ClientApp"));
		String ver = ConvertUtility.getValueAsString(TransData.getRequestHeader("ClientVer"));
		CalculatePool.queueUserWorkItem(()->{
			ICache cache = AstroCacheHelper.getOnlineUserCache();
			if(cache == null) {
				return;
			}
			
			Map<String, Object> map = new HashMap<String, Object>();
			map.put("_id", tmpuser.getLoginId());
			map.put("loginId", tmpuser.getLoginId());
			map.put("channel", channel);
			map.put("app", app);
			map.put("ver", ver);
			map.put("time", System.currentTimeMillis());
			cache.setMap(tmpuser.getLoginId(), map);
		});
		
		return true; 
	}

	@Override
	public void postHandle(HttpServletRequest request,
			HttpServletResponse response, Object handler,
			ModelAndView modelAndView) throws Exception {

	}

	@Override
	public void afterCompletion(HttpServletRequest request,
			HttpServletResponse response, Object handler, Exception ex)
			throws Exception {
		
	}

}
