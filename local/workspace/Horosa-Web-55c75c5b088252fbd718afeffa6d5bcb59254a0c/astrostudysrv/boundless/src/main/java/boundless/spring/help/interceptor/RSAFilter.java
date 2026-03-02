package boundless.spring.help.interceptor;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import boundless.exception.ErrorCodeException;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.spring.help.PropertyPlaceholder;
import boundless.spring.help.TransLogMongoHelper;
import boundless.utility.ConsoleUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class RSAFilter implements Filter {
	private static final String ResultKey = PropertyPlaceholder.getProperty("response.unified.result.key", KeyConstants.ResultMessage);

	private static RequestHeaderInterceptor interceptor = new RequestHeaderInterceptor();
	
	private void doFilter(final HttpServletRequest request, final HttpServletResponse response, final FilterChain chain) throws IOException, ServletException {
		try {
	        String contype = request.getContentType();
	        if(contype != null) {
	        	contype = contype.toLowerCase().trim();
	        }
	        if(contype != null && (contype.startsWith("application/json") || contype.startsWith("multipart/form-data;"))) {
	        	boolean flag = interceptor.preHandle(request, response, null);
				if(contype.startsWith("multipart/form-data;")) {
					chain.doFilter(request, response);					
				}else if(flag) {
					SafeHttpServletRequestWrapper requestWrapper = new SafeHttpServletRequestWrapper(request);
					chain.doFilter(requestWrapper, response);
				}else {
					chain.doFilter(request, response);
				}
	        }else {
	        	Map<String, Object> header = new HashMap<String, Object>();
	        	Map<String, Object> args = interceptor.genArgs(request, header);
	        	TransData.setRequestData(header, args);
				chain.doFilter(request, response);
			}
	        String simpledata = response.getHeader("SimpleData");
	        if(simpledata == null || !simpledata.equals("1")) {
		        interceptor.afterCompletion(request, response, null, null);	        	
	        }
		}catch(Exception e) {
			Exception ex = (Exception)request.getAttribute(KeyConstants.AttrExceptionObj);
			if(ex == null) {
				request.setAttribute(KeyConstants.AttrExceptionObj, e);
				TransLogMongoHelper.logTransCode(request, response);
			}
			
			QueueLog.error(AppLoggers.ErrorLogger, e);
			
			treatException(request, response, e);
		}
	}
		
	private void treatException(final HttpServletRequest request, final HttpServletResponse response, Exception e) {
		Map<String, Object> map = ResultConvertor.convertException(e);

		try {
			Map<String, Object> header = TransData.getRequestHeader();
			String json = JsonUtility.encodePretty(map);
			json = interceptor.encrypt(json, response, header);
			TransData.clearTransData();
			response.getOutputStream().write(json.getBytes("UTF-8"));
			response.flushBuffer();					
		}catch(Exception err) {
			throw new RuntimeException(err);
		}

	}

	@Override
	public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws IOException, ServletException {
		if (request instanceof HttpServletRequest && response instanceof HttpServletResponse) {
			doFilter((HttpServletRequest)request, (HttpServletResponse)response, chain);
		} else {
			throw new ServletException("Cannot filter non-HTTP requests/responses");
		}
	}

	@Override
	public void init(FilterConfig filterConfig) throws ServletException {

	}

	@Override
	public void destroy() {

	}

	
}
