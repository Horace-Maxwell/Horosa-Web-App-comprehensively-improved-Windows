package boundless.spring.help.interceptor;

import java.io.IOException;
import java.lang.reflect.Method;
import java.lang.reflect.Type;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpOutputMessage;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageNotWritableException;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;

import com.fasterxml.jackson.databind.ObjectMapper;

import boundless.exception.ErrorCodeException;
import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.security.SimpleWebSocketSecUtility;
import boundless.spring.help.PropertyPlaceholder;
import boundless.utility.ConvertUtility;
import boundless.utility.FormatUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class JsonConverter extends MappingJackson2HttpMessageConverter {
	
	private static final String ResultKey = PropertyPlaceholder.getProperty("response.unified.result.key", KeyConstants.ResultMessage);
	private static final boolean encodePretty = PropertyPlaceholder.getPropertyAsBool("response.prettyformat", true);
	private static final boolean rawData = PropertyPlaceholder.getPropertyAsBool("response.rawdata", false);

	private static final boolean rspEncrypt = PropertyPlaceholder.getPropertyAsBool("rspencrypt", false);
	private static Map<String, Map<String, Object>> rsaKeys = new HashMap<String, Map<String, Object>>();

	private static final String RSAParamClass = PropertyPlaceholder.getProperty("webencrypt.rsaparam.class", "");
	private static Method rsaParamMethod = null;
	
	static {
		try {
			String rsakeyjson = FileUtility.getStringFromClassPath("data/rsakey.json");
			Map<String, Object> keys = JsonUtility.toDictionary(rsakeyjson);
			rsaKeys = (Map<String, Map<String, Object>>) keys.get("app");
			
			if(!StringUtility.isNullOrEmpty(RSAParamClass)) {
				Class clz = Class.forName(RSAParamClass);
				rsaParamMethod = clz.getMethod("getRsaParam", Map.class);
			}
		}catch(Exception e) {
			
		}
	}
	
	
	public JsonConverter() {
		this.setPrettyPrint(encodePretty);
	}

	public JsonConverter(ObjectMapper objectMapper) {
		super(objectMapper);
		this.setPrettyPrint(encodePretty);
	}
	
	private Object getData(Map<String, Object> map, String key){
		Object obj = map.get(key);
		if(obj == null){
			obj = map.get(key.toLowerCase());
		}
		return obj;
	}
	
	private String getModulus(Map<String, Object> header) {
		if(rsaParamMethod != null) {
			try {
				RsaParam rsa = (RsaParam)header.get(KeyConstants.RsaParam);
				if(rsa == null) {
					rsa = (RsaParam) rsaParamMethod.invoke(null, header);
				}
				return rsa.modulus;
			}catch(Exception e) {
				QueueLog.error(AppLoggers.ErrorLogger, "no rsa param");
				return null;
			}
		}
		String app = ConvertUtility.getValueAsString(getData(header, "ClientApp"));
		Map<String, Object> rsa =  rsaKeys.get(app);
		if(rsa == null) {
			return null;
		}
		String modulus = (String)rsa.get("modulus");
		return modulus;
	}
	
	private String getPrivExp(Map<String, Object> header) {
		if(rsaParamMethod != null) {
			try {
				RsaParam rsa = (RsaParam)header.get(KeyConstants.RsaParam);
				if(rsa == null) {
					rsa = (RsaParam) rsaParamMethod.invoke(null, header);
				}
				return rsa.privexp;
			}catch(Exception e) {
				QueueLog.error(AppLoggers.ErrorLogger, e);
				return null;
			}
		}
		String app = ConvertUtility.getValueAsString(getData(header, "ClientApp"));
		Map<String, Object> rsa =  rsaKeys.get(app);
		if(rsa == null) {
			return null;
		}
		String privexp = (String)rsa.get("privateexp");
		return privexp;
	}
	
	
	private boolean getRspEncrypt(Map<String, Object> header) {
		if(rsaParamMethod != null) {
			try {
				RsaParam rsa = (RsaParam)header.get(KeyConstants.RsaParam);
				if(rsa == null) {
					rsa = (RsaParam) rsaParamMethod.invoke(null, header);
				}
				return rsa.rspencrypt;
			}catch(Exception e) {
				QueueLog.error(AppLoggers.ErrorLogger, "no rsa param");
				return false;
			}
		}
		String app = ConvertUtility.getValueAsString(getData(header, "ClientApp"));
		Map<String, Object> rsa =  rsaKeys.get(app);
		if(rsa == null) {
			return rspEncrypt;
		}
		return ConvertUtility.getValueAsBool(rsa.get("rspencrypt"), rspEncrypt);
	}
	
	
	private boolean needEncryp(HttpOutputMessage outputMessage) {
		Map<String, Object> header = TransData.getRequestHeader();
		String privexp = getPrivExp(header);
		String modulus = getModulus(header);
		boolean rspenc = getRspEncrypt(header);
		if(!rspenc || StringUtility.isNullOrEmpty(modulus) || StringUtility.isNullOrEmpty(privexp)) {
			return false;
		}
		HttpHeaders headers = outputMessage.getHeaders();
		String enc = headers.getFirst("Encrypted");
		if(!StringUtility.isNullOrEmpty(enc) && "0".equals(enc)) {
			return false;
		}
		
		return true;
	}

	@Override
	public boolean canWrite(Class<?> clazz, MediaType mediaType) {
		if(TransData.isSSE()) {
			return true;
		}
		boolean flag = super.canWrite(clazz, mediaType);
		return flag;
	}

	@Override
	protected void writeInternal(Object object, Type type, HttpOutputMessage outputMessage)
			throws IOException, HttpMessageNotWritableException {
		
		Map<String, Object> header = TransData.getRequestHeader();
		String privexp = getPrivExp(header);
		String modulus = getModulus(header);
		
		boolean haserr = ConvertUtility.getValueAsBool(TransData.getReqeustAttribute(KeyConstants.AttrExceptionOccured), false);
		
		if(object instanceof String || object instanceof Long || object instanceof Double || object instanceof Float || 
				object instanceof Integer || object instanceof Short || object instanceof Byte || object instanceof Boolean || 
				object.getClass().isPrimitive() || object instanceof Date || object instanceof LocalDateTime ||
				object instanceof BigDecimal || object instanceof BigInteger){
			String str = object + "";
			if(object instanceof Date){
				str = FormatUtility.formatDateTime((Date)object, "yyyy-MM-dd HH:mm:ss");
			}
			if(object instanceof LocalDateTime){
				LocalDateTime locdt = (LocalDateTime)object;
				str = FormatUtility.formatDateTime(locdt);
			}
			if(needEncryp(outputMessage) && privexp!= null){
				byte[] raw = str.getBytes("UTF-8");
				str = SimpleWebSocketSecUtility.encrypt(raw, modulus, privexp);
				outputMessage.getHeaders().add("Encrypted", "1");
				outputMessage.getHeaders().set("Encrypted", "1");
			}else {
				outputMessage.getHeaders().add("SimpleData", "1");
				outputMessage.getHeaders().set("SimpleData", "1");				
			}
			outputMessage.getBody().write(str.getBytes("UTF-8"));
			outputMessage.getBody().flush();
			return;
		}
		
		if(rawData || StringUtility.isNullOrEmpty(ResultKey) || (object instanceof Map && ((Map)object).containsKey(KeyConstants.ResultCode))) {
			if(needEncryp(outputMessage) && privexp!= null) {
				String str = JsonUtility.encodePretty(object);
				byte[] raw = str.getBytes("UTF-8");
				String encoded = SimpleWebSocketSecUtility.encrypt(raw, modulus, privexp);
				outputMessage.getHeaders().add("Encrypted", "1");
				outputMessage.getHeaders().set("Encrypted", "1");
				outputMessage.getBody().write(encoded.getBytes("UTF-8"));

				TransData.clearTransData();
				outputMessage.getBody().flush();
				return;
			}else {
				if(haserr) {
					Map<String, Object> tmpmap = (Map<String, Object>)object;
					long errcode = ConvertUtility.getValueAsLong(TransData.getResponseHeader(KeyConstants.ResultCode));
					String err = (String) TransData.getResponseHeader(KeyConstants.ResultKey);
					tmpmap.put(KeyConstants.ResultCode, errcode);
					tmpmap.put(KeyConstants.ResultMessage, err);					
				}
				super.writeInternal(object, type, outputMessage);						
			}
		}else {
			Map<String, Object> map;
			if(object instanceof Map) {
				Map<String, Object> tmpmap = (Map<String, Object>)object;
				if(tmpmap.containsKey("status") && tmpmap.containsKey("error")) {
					String msg = (String) tmpmap.get("error");
					if(msg != null) {
						msg = msg.toLowerCase();
					}
					int code = ConvertUtility.getValueAsInt(tmpmap.get("status"), 9999);
					ErrorCodeException err = new ErrorCodeException(code, msg);
					map = ResultConvertor.convertException(err);
				}else {
					if(haserr) {
						map = (Map<String, Object>) object;
					}else {
						map = ResultConvertor.convertResult(object);						
					}
				}
			}else {
				if(haserr) {
					ErrorCodeException err = new ErrorCodeException(9999, object.toString());
					map = ResultConvertor.convertException(err);
				}else {
					map = ResultConvertor.convertResult(object);					
				}
			}

			if(needEncryp(outputMessage) && privexp!= null) {
				String str = JsonUtility.encodePretty(map);
				byte[] raw = str.getBytes("UTF-8");
				String encoded = SimpleWebSocketSecUtility.encrypt(raw, modulus, privexp);
				outputMessage.getHeaders().add("Encrypted", "1");
				outputMessage.getHeaders().set("Encrypted", "1");
				outputMessage.getBody().write(encoded.getBytes("UTF-8"));

				TransData.clearTransData();
				outputMessage.getBody().flush();
				return;
			}else {
				super.writeInternal(map, Map.class, outputMessage);						
			}
		}
		
	}
	
}
