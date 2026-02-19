package boundless.spring.help.interceptor;

import java.net.URLDecoder;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.Part;

import org.springframework.core.MethodParameter;
import org.springframework.util.MultiValueMap;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.support.DefaultMultipartHttpServletRequest;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.ModelAndView;

import boundless.exception.ErrorCodeException;
import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.spring.help.PropertyPlaceholder;
import boundless.spring.help.interceptor.TransData.MultipartObject;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class RequestHeaderJsonInterceptor implements HandlerInterceptor {
	
	private static final String ResultKey = PropertyPlaceholder.getProperty("response.unified.result.key", "");
	private static final boolean encodePretty = PropertyPlaceholder.getPropertyAsBool("response.prettyformat", true);

	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
		Map<String, Object> header = new HashMap<String, Object>();
		Enumeration<String> names = request.getHeaderNames();
		while(names.hasMoreElements()){
			String name = names.nextElement();
			Enumeration<String> head = request.getHeaders(name);
			List<String> values = new ArrayList<String>();
			while(head.hasMoreElements()){
				values.add(head.nextElement());
			}
			if(values.size() == 1){
				header.put(name, values.get(0));
			}else if(values.size() > 1){
				String[] v = new String[values.size()];
				values.toArray(v);
				header.put(name, v);
			}
		}
		Map<String, String[]> params = request.getParameterMap();
		Map<String, Object> args = new HashMap<String, Object>();
		for(Map.Entry<String, String[]> entry : params.entrySet()){
			String key = entry.getKey();
			String[] values = entry.getValue();
			if(values.length == 1){
				args.put(key, values[0]);
			}else{
				args.put(key, values);
			}
		}
		
		try{
			boolean isjson = true;
			byte[] data = FileUtility.getBytesFromStream(request.getInputStream());
			String body = new String(data, "UTF-8");
			String[] parts = StringUtility.splitString(body, '&');
			if(parts.length > 1){
				for(String arg : parts){
					String[] kv = StringUtility.splitString(arg, '=');
					if(kv.length == 2){
						args.put(kv[0], URLDecoder.decode(kv[1], "UTF-8"));
						isjson = false;
					}
				}
			}
			if(!StringUtility.isNullOrEmpty(body) && isjson){
				try{
					Map<String, Object> map = JsonUtility.toDictionary(body);
					args.putAll(map);
				}catch(Exception e){
					QueueLog.error(AppLoggers.ErrorLogger, e.getMessage());
					isjson = false;
				}
			}
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e.getMessage());
		}
		
		TransData.setRequestData(header, args);

		if(request instanceof DefaultMultipartHttpServletRequest){
			DefaultMultipartHttpServletRequest multirequest = (DefaultMultipartHttpServletRequest) request;
			MultiValueMap<String, MultipartFile> filemap = multirequest.getMultiFileMap();
			List<MultipartObject> parts = new ArrayList<MultipartObject>();
			if(filemap != null && !filemap.isEmpty()){
				for(Map.Entry<String, List<MultipartFile>> entry : filemap.entrySet()){
					MultipartObject part = new MultipartObject();
					part.fieldName = entry.getKey();
					List<MultipartFile> mfiles = entry.getValue();
					part.files = new MultipartFile[mfiles.size()];
					mfiles.toArray(part.files);
					parts.add(part);
				}
			}else{
				for(Part part : request.getParts()){
					String conttype = part.getContentType();
					if(conttype != null && (conttype.contains("application/octet-stream") || conttype.contains("multipart/form-data"))){
						MultipartObject mpart = new MultipartObject();
						mpart.data = new TransData.MultipartData(part.getInputStream(), part.getName(), part.getSubmittedFileName());
						mpart.fieldName = part.getName();
						parts.add(mpart);
					}
				}
			}
			TransData.setMultiparts(parts);
		}
		
		TransData.setRequestObject(request, response);
		
		return true;
	}

	@Override
	public void postHandle(HttpServletRequest request, HttpServletResponse response, Object handler, ModelAndView modelAndView) throws Exception {

	}

	@Override
	public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) throws Exception {
		Map<String, Object> responseheadmap = TransData.getAllResponseHeaders();
		for(Map.Entry<String, Object> entry : responseheadmap.entrySet()){
			String key = entry.getKey();
			Object obj = entry.getValue();
			response.setHeader(key, ConvertUtility.getValueAsString(obj));
		}

		boolean exptOccured = ConvertUtility.getValueAsBool(request.getAttribute(KeyConstants.AttrExceptionOccured), false);
		if(ex != null || exptOccured){
			if(ex instanceof ErrorCodeException){
				response.setHeader(KeyConstants.ResultCode, ((ErrorCodeException) ex).getCode()+"");
			}else{
				response.setHeader(KeyConstants.ResultCode, KeyConstants.FailCode + "");
			}
			if(ex != null){
				response.setHeader(KeyConstants.ResultMessage, ex.getMessage());
			}
			
			return;
		}
		
		response.setHeader(KeyConstants.ResultCode, KeyConstants.SuccessCode + "");
		response.setHeader(KeyConstants.ResultMessage, "");

		if(handler instanceof HandlerMethod){
			HandlerMethod mhandler = (HandlerMethod)handler;
			MethodParameter p = mhandler.getReturnType();
			Class t = p.getParameterType();
			String n = t.getName();
			if(n.equalsIgnoreCase("void")){
				response.setContentType("application/json; charset=UTF-8");
				
				Map<String, Object> map = new HashMap<String, Object>();

				Object obj = TransData.getResponseData();
				if(StringUtility.isNullOrEmpty(ResultKey)){
					map.put(KeyConstants.ResultMessage, obj);
				}else{
					map.put(ResultKey, obj);
				}
				map.put(KeyConstants.ResultCode, KeyConstants.SuccessCode);
				
				if(StringUtility.isNullOrEmpty(ResultKey)){
					if(StringUtility.isNullOrEmpty(obj)){
						return;
					}
					if(obj instanceof String){
						String str = (String) obj;
						response.setContentType("application/octet-stream; charset=UTF-8");
						response.getOutputStream().write(str.getBytes("UTF-8"));
						response.flushBuffer();
					}else{
						String json;
						if(encodePretty){
							json = JsonUtility.encodePretty(map);
						}else{
							json = JsonUtility.encode(map);
						}
						response.getOutputStream().write(json.getBytes("UTF-8"));
						response.flushBuffer();
					}
					return;
				}
				
				String json;
				if(encodePretty){
					json = JsonUtility.encodePretty(map);
				}else{
					json = JsonUtility.encode(map);
				}
				response.getOutputStream().write(json.getBytes("UTF-8"));
				response.flushBuffer();
			}
		}
	}

}
