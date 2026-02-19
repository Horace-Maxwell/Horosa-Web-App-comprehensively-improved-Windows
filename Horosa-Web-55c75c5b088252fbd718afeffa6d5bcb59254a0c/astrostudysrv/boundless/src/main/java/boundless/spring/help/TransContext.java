package boundless.spring.help;

import java.math.BigDecimal;
import java.util.Date;
import java.util.Map;

import javax.servlet.ServletRequest;

import org.springframework.core.NamedThreadLocal;

import boundless.utility.ConvertUtility;
import boundless.utility.FormatUtility;

public class TransContext {

	public static final String ContextKey = "_context";
	public static final String DataKey = "_requestdata";

	private static NamedThreadLocal<Object>  requestPkgThreadLocal =   
			new NamedThreadLocal<Object>("_RequestPacket"); 
	
	private static NamedThreadLocal<Object>  responsePkgThreadLocal =   
			new NamedThreadLocal<Object>("_ResponsePacket"); 
	

	public static Map<String, Object> getContext(ServletRequest request){
		return (Map<String, Object>) request.getAttribute(ContextKey);
	}
	
	public static void initContext(Map<String, Object> map, ServletRequest request){
		request.setAttribute(TransContext.ContextKey, map);
	}

	public static Object get(String key, ServletRequest request){
		Map<String, Object> map = getContext(request);
		return map.get(key);
	}
	
	public static String getValueAsString(String key, ServletRequest request){
		return ConvertUtility.getValueAsString(get(key, request));
	}

	public static long getValueAsLong(String key, ServletRequest request){
		String value = ConvertUtility.getValueAsString(get(key, request)).replaceAll(",", "");
		return ConvertUtility.getValueAsLong(value);
	}

	public static int getValueAsInt(String key, ServletRequest request){
		String value = ConvertUtility.getValueAsString(get(key, request)).replaceAll(",", "");
		return ConvertUtility.getValueAsInt(value);
	}

	public static BigDecimal getValueAsBigDecimal(String key, ServletRequest request){
		String value = ConvertUtility.getValueAsString(get(key, request)).replaceAll(",", "");
		return ConvertUtility.getValueAsBigDecimal(value);
	}

	public static double getValueAsDouble(String key, ServletRequest request){
		String value = ConvertUtility.getValueAsString(get(key, request)).replaceAll(",", "");
		return ConvertUtility.getValueAsDouble(value);
	}

	public static Date getValueAsDate(String key, ServletRequest request, String format){
		return FormatUtility.parseDateTime(getValueAsString(key, request), format);
	}

	public static void put(String key, Object value, ServletRequest request){
		Map<String, Object> map = getContext(request);
		map.put(key, value);
	}
	
	public static String toSerializeString(ServletRequest request){
		Map<String, Object> context = getContext(request);
		return ConvertUtility.toSerializeString(context);
	}
	
	public static Map<String, Object> fromSerializeString(ServletRequest request){
		String data = (String) get("_data", request);
		return (Map<String, Object>) ConvertUtility.fromSerializeString(data);
	}
	
	
	public static Object getRequestPacket(){
		return requestPkgThreadLocal.get();
	}
	
	public static void setRequestPacket(Object packet){
		requestPkgThreadLocal.set(packet);
	}

	public static Object getResponsePacket(){
		return responsePkgThreadLocal.get();
	}
	
	public static void setResponsePacket(Object packet){
		responsePkgThreadLocal.set(packet);
	}
	
	
}
