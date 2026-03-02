package spacex.astrostudy.interceptor;


import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.ModelAndView;

import boundless.spring.help.interceptor.TransData;
import boundless.web.common.IUser;
import spacex.astrostudy.helper.PrivilegeHelper;

public class CommInterceptor implements HandlerInterceptor {
	
	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
		
		String token = TransData.getToken();
		if(token != null){
			IUser user = PrivilegeHelper.getUser(token);
			if(user != null){
				TransData.setCurrentUser(user);
			}
		}
		
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
