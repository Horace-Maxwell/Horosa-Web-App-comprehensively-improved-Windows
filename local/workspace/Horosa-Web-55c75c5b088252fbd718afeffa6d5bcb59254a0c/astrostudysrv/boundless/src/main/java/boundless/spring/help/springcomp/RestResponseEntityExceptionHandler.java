package boundless.spring.help.springcomp;

import java.net.URLEncoder;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import javax.servlet.http.HttpServletRequest;

import org.slf4j.Logger;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import boundless.exception.ErrorCodeException;
import boundless.exception.HttpStatusException;
import boundless.exception.NeedLoginException;
import boundless.exception.ParamsErrorException;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.spring.help.PropertyPlaceholder;
import boundless.spring.help.interceptor.KeyConstants;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.StringUtility;
import boundless.web.help.AppServerPathHelper;
import boundless.spring.help.interceptor.ResultConvertor;

@ControllerAdvice
public class RestResponseEntityExceptionHandler extends ResponseEntityExceptionHandler {	
	private static String excludeLogErrorCodesStr = PropertyPlaceholder.getProperty("excludelog.errorcodes", "");
	private static Set<String> excludeLogErrorCodes = new HashSet<String>();
	static{
		String[] codes = StringUtility.splitString(excludeLogErrorCodesStr, ',');
		for(String code : codes){
			excludeLogErrorCodes.add(code.trim());
		}
		
	}

	private String getExMsg(Exception ex) {
        String bodyOfResponse = ex.getMessage();
        if(bodyOfResponse == null) {
        	bodyOfResponse = ex.toString();
        }
        bodyOfResponse = PropertyPlaceholder.getProperty(bodyOfResponse, bodyOfResponse);
		
        if(ex instanceof ErrorCodeException) {
			ErrorCodeException err = (ErrorCodeException) ex;
			String errmsgkey = KeyConstants.getErrorKey(err.getCode());
			String errmsg = PropertyPlaceholder.getProperty(errmsgkey, "");
			if(!StringUtility.isNullOrEmpty(errmsg)) {
				bodyOfResponse = errmsg;
			}
        }
        
        return bodyOfResponse;
	}

	@ExceptionHandler(Exception.class)
    public ResponseEntity<Object> handleSrvException(Exception ex, WebRequest request) {
		String bodyOfResponse = getExMsg(ex);
		int code = 9999;
		
		TransData.setReqeustAttribute(KeyConstants.AttrExceptionOccured, true);
		request.setAttribute(KeyConstants.AttrExceptionOccured, true, RequestAttributes.SCOPE_REQUEST);
		String userip = AppServerPathHelper.getClientIp(request);
		Logger errlog = AppLoggers.ErrorLogger;

		if(ex instanceof ErrorCodeException){
			ErrorCodeException err = (ErrorCodeException) ex;
			code = err.getCode();
			if(!excludeLogErrorCodes.contains(code+"")){
				errlog = AppLoggers.getLog(err.getLogDir(), err.getLogfileName());
			}else{
				errlog = null;
			}
		}else if(ex instanceof ParamsErrorException){
			ParamsErrorException parexception = (ParamsErrorException)ex;
			errlog = AppLoggers.getLog("ParamsError", parexception.getLogfileName());;
		}else if(ex instanceof HttpStatusException){
			HttpStatusException statusex = (HttpStatusException)ex;
			errlog = AppLoggers.getLog("error", statusex.getStatus()+"");
		}else{
			errlog = AppLoggers.ErrorLogger;
		}
		
		request.setAttribute(KeyConstants.AttrExceptionObj, ex, RequestAttributes.SCOPE_REQUEST);
		request.setAttribute(KeyConstants.AttrExceptionMsg, bodyOfResponse, RequestAttributes.SCOPE_REQUEST);
		request.setAttribute(KeyConstants.AttrExceptionCode, code, RequestAttributes.SCOPE_REQUEST);
		
		MultiValueMap<String, String> headers = new LinkedMultiValueMap<String, String>();
		Map<String, Object> responseheadmap = TransData.getAllResponseHeaders();
		for(Map.Entry<String, Object> entry : responseheadmap.entrySet()){
			String key = entry.getKey();
			Object obj = entry.getValue();
			headers.add(key, obj.toString());
		}
		
		headers.add(KeyConstants.ResultCode, code+"");
		TransData.setResponseHead(KeyConstants.ResultCode, code+"");
		
		if(bodyOfResponse != null) {
			try {
				headers.add(KeyConstants.ResultMessage, URLEncoder.encode(bodyOfResponse, "UTF-8"));
				TransData.setResponseHead(KeyConstants.ResultMessage, URLEncoder.encode(bodyOfResponse, "UTF-8"));
			} catch (Exception e) {
				headers.add(KeyConstants.ResultMessage, StringUtility.encodeHtml(bodyOfResponse));
				TransData.setResponseHead(KeyConstants.ResultMessage, StringUtility.encodeHtml(bodyOfResponse));
			}			
		}
		if(ex instanceof NeedLoginException){
			request.setAttribute(KeyConstants.NeedLoginKey, "1", RequestAttributes.SCOPE_REQUEST);
			headers.add(KeyConstants.NeedLoginKey, "1");
		}

		if(errlog != null){
			if(request instanceof ServletWebRequest){
				String data = TransData.getRequestJsonWithHead();
				ServletWebRequest req = (ServletWebRequest) request;
				HttpServletRequest httpreq = req.getRequest();
				
				QueueLog.error(errlog, "userip:{} requestUrl:{}?{}\n request data:\n{} ", 
						userip, httpreq.getRequestURI(), httpreq.getQueryString(), data);
			}
			QueueLog.error(errlog, ex);
		}

		headers.add("ContentType", "application/json; charset=UTF-8");
		headers.add("Content-Type", "application/json; charset=UTF-8");
		headers.add("content-type", "application/json; charset=UTF-8");
		
		Map<String, Object> map = ResultConvertor.convertException(ex);
		
		ResponseEntity<Object> respentity = new ResponseEntity<Object>(map, headers, HttpStatus.INTERNAL_SERVER_ERROR);
		
		return respentity;
    }
	
}
