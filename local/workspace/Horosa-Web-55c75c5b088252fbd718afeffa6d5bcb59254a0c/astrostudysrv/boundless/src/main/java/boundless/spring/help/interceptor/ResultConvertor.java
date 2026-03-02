package boundless.spring.help.interceptor;

import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;

import boundless.exception.ErrorCodeException;
import boundless.exception.HttpStatusException;
import boundless.io.FileUtility;
import boundless.spring.help.PropertyPlaceholder;
import boundless.types.Tuple;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class ResultConvertor {
	private static final String ResultKey = PropertyPlaceholder.getProperty("response.unified.result.key", KeyConstants.ResultMessage);

	private static Method noRestfulResultMeth;
	private static Method noRestfulExceptMeth;
	private static Map<String, Tuple<Method, Method>> appResultMethods = new HashMap<String, Tuple<Method, Method>>();

	static {
		try {
			String json = FileUtility.getStringFromClassPath("data/resultconvertor.json");
			Map<String, Object> map = JsonUtility.toDictionary(json);

			Class norestcls = Class.forName((String)map.get("noRestfulResultClass"));
			noRestfulResultMeth = norestcls.getMethod("convertResult", Object.class);
			noRestfulExceptMeth = norestcls.getMethod("convertException", Exception.class);
			Map<String, Object> appResultClsMap = (Map<String, Object>) map.get("appResultClass");
			for(Map.Entry<String, Object> entry : appResultClsMap.entrySet()) {
				String app = entry.getKey();
				String clsname = (String) entry.getValue();
				Class  cls = Class.forName(clsname);
				Method resmeth = cls.getMethod("convertResult", Object.class);
				Method expmeth = cls.getMethod("convertException", Exception.class);
				Tuple<Method, Method> tuple = new Tuple<Method, Method>(resmeth, expmeth);
				appResultMethods.put(app, tuple);
			}
			
		}catch(Exception e) {
			throw new RuntimeException(e);
		}

	}

	private static Map<String, Object> genResultMap(Object obj){
		Map<String, Object> map = new HashMap<String, Object>();
		if(StringUtility.isNullOrEmpty(ResultKey)){
			map.put(KeyConstants.ResultMessage, obj);
		}else{
			map.put(ResultKey, obj);
		}
		map.put(KeyConstants.ResultCode, KeyConstants.SuccessCode);

		if(TransData.isNoRestful()) {
			map = NoRestResultHandle.getResultMap(obj);
		}
		
		return map;
	}
	
	private static Map<String, Object> genExceptionMap(Exception ex){
		Map<String, Object> map = new HashMap<String, Object>();
        String bodyOfResponse = ex.getMessage();
        if(bodyOfResponse == null) {
        	bodyOfResponse = ex.toString();
        }
        bodyOfResponse = PropertyPlaceholder.getProperty(bodyOfResponse, bodyOfResponse);
        String reskey = ResultKey;
		if(StringUtility.isNullOrEmpty(ResultKey)){
			reskey = KeyConstants.ResultMessage;
		}
		map.put(reskey, bodyOfResponse);
		
		if(ex instanceof ErrorCodeException) {
			ErrorCodeException err = (ErrorCodeException) ex;
			map.put(KeyConstants.ResultCode, err.getCode());
			String errmsgkey = KeyConstants.getErrorKey(err.getCode());
			String errmsg = PropertyPlaceholder.getProperty(errmsgkey, "");
			if(!StringUtility.isNullOrEmpty(errmsg)) {
				map.put(reskey, errmsg);
			}
			
		}else if(ex instanceof HttpStatusException){
			HttpStatusException statusex = (HttpStatusException)ex;
			HttpStatus httpstatus = HttpStatus.resolve(statusex.getStatus());
			map.put(KeyConstants.ResultCode, statusex.getStatus());				
			if(httpstatus == null) {
				map.put(reskey, HttpStatus.INTERNAL_SERVER_ERROR.getReasonPhrase());
			}else {
				map.put(reskey, httpstatus.getReasonPhrase());
			}
		}else {
			map.put(KeyConstants.ResultCode, 9999);	
		}

		
		return map;
	}
	
	public static Map<String, Object> convertResult(Object obj){
		String app = TransData.getClientApp();
		Method meth = null;
		if(!StringUtility.isNullOrEmpty(app)) {
			Tuple<Method, Method> tuple = appResultMethods.get(app);
			if(tuple != null) {
				meth = tuple.item1();				
			}
		}
		if(meth == null) {
			if(TransData.isNoRestful()) {
				meth = noRestfulResultMeth;
			}else {
				return genResultMap(obj);
			}
		}
		
		try {
			return (Map<String, Object>) meth.invoke(null, obj);			
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}
	
	public static Map<String, Object> convertException(Exception e){
		String app = TransData.getClientApp();
		Method meth = null;
		if(!StringUtility.isNullOrEmpty(app)) {
			Tuple<Method, Method> tuple = appResultMethods.get(app);
			if(tuple != null) {
				meth = tuple.item2();				
			}
		}
		if(meth == null) {
			if(TransData.isNoRestful()) {
				meth = noRestfulExceptMeth;
			}else {
				return genExceptionMap(e);
			}
		}
		try {
			return (Map<String, Object>) meth.invoke(null, e);			
		}catch(Exception err) {
			throw new RuntimeException(err);
		}		
	}
}
