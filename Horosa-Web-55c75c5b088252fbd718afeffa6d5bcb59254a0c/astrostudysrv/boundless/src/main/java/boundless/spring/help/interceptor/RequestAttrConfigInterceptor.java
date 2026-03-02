package boundless.spring.help.interceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.ModelAndView;

import boundless.web.common.RequestAttributeKey;


public class RequestAttrConfigInterceptor implements HandlerInterceptor {

	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
		String ctxpath = request.getContextPath();
		request.setAttribute(RequestAttributeKey.CtxKey, ctxpath);
		request.setAttribute(RequestAttributeKey.TransjsKey, ctxpath + "/transjs");
		
		String path = request.getRequestURI();
		request.setAttribute(RequestAttributeKey.TransUrlKey, path);
		
		String url = request.getRequestURL().toString();
		int idx = url.lastIndexOf(ctxpath);
		String urlroot = url.substring(0, idx);
		request.setAttribute(RequestAttributeKey.UrlRootKey, urlroot);

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
