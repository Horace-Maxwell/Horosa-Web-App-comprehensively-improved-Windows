package boundless.spring.help.interceptor;

import java.util.HashMap;
import java.util.Map;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.PropertyPlaceholder;

public class NoRestResultConverter {

	public static Map<String, Object> convertResult(Object obj){
		Map<String, Object> map = new HashMap<String, Object>();
		map.put("result", obj);
		map.put("msg", "ok");
		map.put("info", null);
		map.put("err", null);
		
		return map;
	}
	
	public static Map<String, Object> convertException(Exception e){
		Map<String, Object> map = new HashMap<String, Object>();
		map.put("result", null);
		String msg = e.getMessage();
		if(!msg.startsWith("err_")) {
			msg = "err_" + msg.replace(".", "_");
		}
		String translatemsg = PropertyPlaceholder.getProperty(msg, msg);
//		String errstack = ConsoleUtility.getStackTrace(e);

		map.put("msg", msg);
		map.put("info", translatemsg);
		map.put("err", msg);
		
		if(e instanceof ErrorCodeException) {
			ErrorCodeException errcode = (ErrorCodeException)e;
			int code = errcode.getCode();
			String info = PropertyPlaceholder.getProperty(code + "", translatemsg);
			map.put("code", code);
			map.put("info", info);
		}else {
			map.put("code", 9999);
			map.put("info", PropertyPlaceholder.getProperty("9999", "服务器内部错误"));
			map.put("err", "err_server_err");
		}

		return map;
	}
	
}
