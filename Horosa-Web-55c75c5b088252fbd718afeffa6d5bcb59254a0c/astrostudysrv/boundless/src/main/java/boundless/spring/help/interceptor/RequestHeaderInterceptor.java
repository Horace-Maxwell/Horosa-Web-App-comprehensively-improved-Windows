package boundless.spring.help.interceptor;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.net.URLDecoder;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Date;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import javax.servlet.ServletOutputStream;
import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.Part;

import org.slf4j.Logger;
import org.springframework.core.MethodParameter;
import org.springframework.util.MultiValueMap;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;
import org.springframework.web.multipart.commons.CommonsMultipartResolver;
import org.springframework.web.multipart.support.DefaultMultipartHttpServletRequest;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.ModelAndView;

import boundless.exception.DecryptException;
import boundless.exception.DecryptTimeoutException;
import boundless.exception.ErrorCodeException;
import boundless.exception.SignatureException;
import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.security.SignatureUtility;
import boundless.security.SimpleWebSocketSecUtility;
import boundless.spring.help.PropertyPlaceholder;
import boundless.spring.help.interceptor.TransData.MultipartObject;
import boundless.spring.help.interceptor.TransData.ResponseRawData;
import boundless.types.FileType;
import boundless.types.OutParameter;
import boundless.types.Tuple;
import boundless.utility.ConvertUtility;
import boundless.utility.FormatUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class RequestHeaderInterceptor implements HandlerInterceptor {
	public static Logger reqBodyLogger;
	
	private static final String ResultKey = PropertyPlaceholder.getProperty("response.unified.result.key", KeyConstants.ResultMessage);
	private static final boolean encodePretty = PropertyPlaceholder.getPropertyAsBool("response.prettyformat", true);
	private static final boolean rawData = PropertyPlaceholder.getPropertyAsBool("response.rawdata", false);
	private static final boolean logRawData = PropertyPlaceholder.getPropertyAsBool("log.rawbody", false);
				
	private static Map<String, Map<String, Object>> rsaKeys = new HashMap<String, Map<String, Object>>();
	
	private static final String ClientAppKey = "__clientapp__";
	private static final String HeaderKey = "__header__";
	private static final String BodyKey = "__body__";
	private static final String CodeKey = "_code_";
	
	private static Map<String, String> SignatureKeyMap = new HashMap<String, String>();
	
	private static boolean checkSign = false;
	private static Set<String> excludeCheckSig = new HashSet<String>();
	private static List<String> excludeSigPrefix = null;
	private static final String NoSigCheck = "nosigchk";

	private static boolean defaultrsa = false;
	private static Set<String> excludeCheckRSA = new HashSet<String>();
	private static List<String> excludeRSAPrefix = null;
	
	private static String noRestfulTransKey;
	
	static {
		try {
			reqBodyLogger = AppLoggers.getLog("raw", "reqbody");
			
			String rsakeyjson = FileUtility.getStringFromClassPath("data/rsakey.json");
			Map<String, Object> map = JsonUtility.toDictionary(rsakeyjson);
			noRestfulTransKey = (String) map.get("noRestfulTransKey");
			if(noRestfulTransKey == null) {
				noRestfulTransKey = "act";
			}
						
			rsaKeys = (Map<String, Map<String, Object>>) map.get("app");
			for(String key : rsaKeys.keySet()) {
				SignatureKeyMap.put(key, (String) rsaKeys.get(key).get("sigkey"));
			}
			
			checkSign = ConvertUtility.getValueAsBool(map.get("checksig"), false);
			Map<String, Object> nosigmap = (Map<String, Object>) map.get("nochksig");
			excludeSigPrefix = (List<String>) nosigmap.get("prefix");
			List<String> nosigcodes = (List<String>) nosigmap.get("transCodes");
			for(String code : nosigcodes) {
				excludeCheckSig.add(code);
			}

			defaultrsa = ConvertUtility.getValueAsBool(map.get("defaultRSA"), false);
			Map<String, Object> norsamap = (Map<String, Object>) map.get("norsa");
			excludeRSAPrefix = (List<String>) norsamap.get("prefix");
			List<String> norsacodes = (List<String>) norsamap.get("transCodes");
			for(String code : nosigcodes) {
				excludeCheckRSA.add(code);
			}
			
		}catch(Exception e) {
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
	}
		
	private Object getData(Map<String, Object> map, String key){
		Object obj = map.get(key);
		if(obj == null){
			obj = map.get(key.toLowerCase());
		}
		return obj;
	}
	
	private String getModulus(Map<String, Object> header) {
		if(header == null || (!header.containsKey(ClientAppKey) && !header.containsKey("ClientApp") && !header.containsKey("clientapp") && !header.containsKey("CLIENTAPP"))) {
			return null;
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
		if(header == null || (!header.containsKey(ClientAppKey) && !header.containsKey("ClientApp") && !header.containsKey("clientapp") && !header.containsKey("CLIENTAPP"))) {
			return null;
		}
		String app = ConvertUtility.getValueAsString(getData(header, "ClientApp"));
		Map<String, Object> rsa =  rsaKeys.get(app);
		if(rsa == null) {
			return null;
		}
		String privexp = (String)rsa.get("privateexp");
		return privexp;
	}
	
	private boolean getReqEncrypt(Map<String, Object> header) {
		if(header == null || (!header.containsKey(ClientAppKey) && !header.containsKey("ClientApp") && !header.containsKey("clientapp") && !header.containsKey("CLIENTAPP"))) {
			return defaultrsa;
		}
		String app = ConvertUtility.getValueAsString(getData(header, "ClientApp"));
		Map<String, Object> rsa =  rsaKeys.get(app);
		if(rsa == null) {
			return defaultrsa;
		}
		return ConvertUtility.getValueAsBool(rsa.get("reqencrypt"), false);
	}
	
	private boolean getRspEncrypt(Map<String, Object> header) {
		if(header == null || (!header.containsKey(ClientAppKey) && !header.containsKey("ClientApp") && !header.containsKey("clientapp") && !header.containsKey("CLIENTAPP"))) {
			return false;
		}
		String app = ConvertUtility.getValueAsString(getData(header, "ClientApp"));
		Map<String, Object> rsa =  rsaKeys.get(app);
		if(rsa == null) {
			return false;
		}
		return ConvertUtility.getValueAsBool(rsa.get("rspencrypt"), false);
	}
	
	
	
	private boolean checkRSA(HttpServletResponse response, Map<String, Object> header) {
		boolean reqenc = getReqEncrypt(header);
		
		String trans = (String) header.get(KeyConstants.TransCode);
		if(trans != null && excludeCheckRSA.contains(trans)) {
			if(!reqenc) {
				response.addHeader("Encrypted", "0");						
			}
			return false;
		}
		if(trans != null) {
			for(String prefix : excludeRSAPrefix) {
				if(trans.startsWith(prefix)) {
					if(!reqenc) {
						response.addHeader("Encrypted", "0");						
					}
					return false;
				}
			}
		}
				
		return reqenc;		
	}
	
	private String decrypt(HttpServletResponse response, Map<String, Object> header, String body, String contentType) throws Exception {
		if(logRawData) {
			QueueLog.debug(reqBodyLogger, "transcode:{}, before decrypt, body:\n{}\n",TransData.getTransCode(), TransData.getNoRestTransCode(), body);					
		}
		String privexp = getPrivExp(header);
		String modulus = getModulus(header);
		if(StringUtility.isNullOrEmpty(body) || body.equalsIgnoreCase("null") || !checkRSA(response, header)) {
			if(header != null) {
				return body;				
			}
		}
		if(StringUtility.isNullOrEmpty(privexp) || StringUtility.isNullOrEmpty(modulus)) {
			return body;
		}
		
		boolean forcetm = false;
		if(!StringUtility.isNullOrEmpty(contentType)) {
			if(contentType.contains("multipart/")) {
				forcetm = false;
			}			
		}
		String transcode = (String)header.get(KeyConstants.TransCode);
		if(!StringUtility.isNullOrEmpty(transcode) && transcode.contains("/common/")) {
			forcetm = false;
		}
		try {
			byte[] raw = SimpleWebSocketSecUtility.decrypt(body, modulus, privexp, forcetm);
			String plain = new String(raw, "UTF-8");
			return plain;			
		}catch(Exception e) {
			QueueLog.error(AppLoggers.ErrorLogger, e);
			throw e;
		}
	}
	
	public String encrypt(String str, HttpServletResponse response, Map<String, Object> header) throws Exception {
		try {
			String privexp = getPrivExp(header);
			String modulus = getModulus(header);
			boolean rspenc = getRspEncrypt(header);
			if(!rspenc || StringUtility.isNullOrEmpty(str) ||
					StringUtility.isNullOrEmpty(modulus) || StringUtility.isNullOrEmpty(privexp)) {
				return str;
			}
			String enc = response.getHeader("Encrypted");
			if(!StringUtility.isNullOrEmpty(enc) && "0".equals(enc)) {
				return str;
			}
			
			byte[] raw = str.getBytes("UTF-8");
			String encoded = SimpleWebSocketSecUtility.encrypt(raw, modulus, privexp);
			
			response.addHeader("Encrypted", "1");
			response.setHeader("Encrypted", "1");
			return encoded;			
		}catch(Exception e) {
			QueueLog.error(AppLoggers.ErrorLogger, e);
			return str;
		}
	}
	
	private void checkSignature(HttpServletRequest request, Map<String, Object> header, String body){
		if(!checkSign){
			return;
		}
				
		String trans = (String) header.get(KeyConstants.TransCode);
		if(excludeCheckSig != null) {
			if(trans != null && excludeCheckSig.contains(trans)) {
				return;
			}
		}
		if(trans != null) {
			for(String prefix : excludeSigPrefix) {
				if(trans.startsWith(prefix)) {
					return;
				}
			}
		}
		
		String channel = ConvertUtility.getValueAsString(getData(header, "ClientChannel"));
		String app = ConvertUtility.getValueAsString(getData(header, "ClientApp"));
		String ver = ConvertUtility.getValueAsString(getData(header, "ClientVer"));
		
		String sigkey = SignatureKeyMap.get(app);
		if(StringUtility.isNullOrEmpty(sigkey)) {
			if(TransData.isNoRestful() ) {
				return;
			}
			throw new SignatureException("no.register.app.in.sys.forapp:" + app);
		}else if(sigkey.equalsIgnoreCase(NoSigCheck)) {
			return;
		}
		String hd = String.format("%s%s%s", channel, app, ver);
		
		String token = (String)getData(header, KeyConstants.Token);
		String signText = (String)getData(header, KeyConstants.Signature);
		if(StringUtility.isNullOrEmpty(signText) || signText.equalsIgnoreCase("null")){
			throw new SignatureException("signature.error");
		}
		
		String txt = body == null ? "" : body;
		String tk = token;
		if(tk == null || tk.equalsIgnoreCase("null")){
			tk = "";
		}
		String str = String.format("%s%s%s%s", tk, sigkey, hd, txt);
		boolean flag = SignatureUtility.checkSha256Signature(str, signText);
		if(!flag) {
			throw new SignatureException("signature.error");
		}
	}
	
	private void checkNoRestTrans(HttpServletRequest request, Map<String, Object> header, Map<String, Object> args)throws Exception {
		if(!args.containsKey(noRestfulTransKey)) {
			request.setAttribute(KeyConstants.NoRestful, false);
			TransData.setNoRestful(false, null);
			return;
		}
		
		request.setAttribute(KeyConstants.NoRestful, true);
		
		String transcode = (String)args.get(noRestfulTransKey);
		if(StringUtility.isNullOrEmpty(transcode)) {
			throw new ErrorCodeException(5999999, "miss_transcode");
		}
		TransData.setNoRestful(true, transcode);
		
		header.put(KeyConstants.NoRestTransCode, transcode);
		header.put(KeyConstants.TransCode, String.format("/norest/%s", transcode));
		String app = TransData.getClientApp();
		if(StringUtility.isNullOrEmpty(app)) {
			TransData.setRequestHead("ClientApp", "norestclient");			
		}
	}
	
	public Map<String, Object> genArgs(HttpServletRequest request, Map<String, Object> header) throws Exception{
		String path = request.getRequestURI();
		String ctx = request.getServletContext().getContextPath();
		path = path.substring(ctx.length());
		header.put(KeyConstants.TransCode, path);

		Cookie[] cookies = request.getCookies();
		if(cookies != null){
			for(Cookie cookie :cookies){
				String cname = cookie.getName();
				header.put(cname, cookie.getValue());
				break;
			}
		}
		
		Enumeration<String> names = request.getHeaderNames();
		while(names.hasMoreElements()){
			String name = names.nextElement();
			String nameLow = name.toLowerCase();
			Enumeration<String> head = request.getHeaders(name);
			List<String> values = new ArrayList<String>();
			while(head.hasMoreElements()){
				values.add(head.nextElement());
			}
			if(values.size() == 1){
				header.put(name, values.get(0));
				header.put(nameLow, values.get(0));
			}else if(values.size() > 1){
				String[] v = new String[values.size()];
				values.toArray(v);
				header.put(name, v);
				header.put(nameLow, v);
			}
		}
		
		Map<String, String[]> params = request.getParameterMap();
		Map<String, Object> args = new HashMap<String, Object>();
		for(Map.Entry<String, String[]> entry : params.entrySet()){
			String key = entry.getKey();
			String[] values = entry.getValue();
			for(int i=0; i<values.length; i++) {
				if(values[i].indexOf('%') >= 0) {
					values[i] = URLDecoder.decode(values[i], "UTF-8");
				}
			}
			if(values.length == 1){
				args.put(key, values[0]);					
			}else{
				args.put(key, values);
			}
		}
		
		if(args.containsKey(ClientAppKey)) {
			Object app = args.get(ClientAppKey);
			header.put("ClientApp", app);
			TransData.setRequestHead("ClientApp", app);
		}
		if(args.containsKey(HeaderKey)) {
			String str = (String)args.get(HeaderKey);
			try {
				Map<String, Object> cushead = JsonUtility.toDictionary(str);
				header.putAll(cushead);
				for(String key : header.keySet()) {
					TransData.setRequestHead(key, header.get(key));
				}
			}catch(Exception e) {
			}
		}
		
		checkNoRestTrans(request, header, args);
				
		return args;
	}
	
	private String decodeHeadAndBody(Map<String, Object> args, Map<String, Object> header, String conttype, HttpServletResponse response, OutParameter<Boolean> hastreated) throws Exception {
		String body = null;
		boolean hastreat = false;
		String transcode = (String)header.get(KeyConstants.TransCode);
		if(args.containsKey(ClientAppKey) && !header.containsKey("ClientApp") && !header.containsKey("clientapp") && !header.containsKey("CLIENTAPP")) {
			Object app = args.get(ClientAppKey);
			header.put("ClientApp", app);
		}
		String privexp = getPrivExp(header);
		String modulus = getModulus(header);
		if(args.containsKey(HeaderKey)) {
			String headerjson = (String) args.get(HeaderKey);
			Map<String, Object> tmphead = new HashMap<String, Object>();
			tmphead.put(KeyConstants.TransCode, transcode);
			if(args.containsKey(ClientAppKey)) {
				Object app = args.get(ClientAppKey);
				tmphead.put("ClientApp", app);
			}
			headerjson = decrypt(response, tmphead, headerjson, conttype);
			Map<String, Object> reqh = JsonUtility.toDictionary(headerjson);
			header.putAll(reqh);
			args.remove(HeaderKey);
			hastreat = true;
		}
		if(args.containsKey(BodyKey)) {
			body = (String) args.get(BodyKey);
			body = decrypt(response, header, body, conttype);
			Map<String, Object> bodymap = JsonUtility.toDictionary(body);
			args.putAll(bodymap);
			args.remove(BodyKey);	
			hastreat = true;
		}
		if(args.containsKey(CodeKey)) {
			String code = (String) args.get(CodeKey);
			boolean forcetm = false;
			if(!StringUtility.isNullOrEmpty(conttype)) {
				if(conttype.contains("multipart/")) {
					forcetm = false;
				}			
			}
			if(!StringUtility.isNullOrEmpty(transcode) && transcode.contains("/common/")) {
				forcetm = false;
			}
			if(!StringUtility.isNullOrEmpty(modulus) && !StringUtility.isNullOrEmpty(privexp)) {
				byte[] raw = SimpleWebSocketSecUtility.decrypt(code, modulus, privexp, forcetm);
				String codejson = new String(raw, "UTF-8");
				Map<String, Object> map = JsonUtility.toDictionary(codejson);
				body = (String) map.get("body");
				Map<String, Object> reqh = (Map<String, Object>) map.get("headers");
				header.putAll(reqh);
				hastreat = true;
			}
		}
		if(hastreated != null) {
			hastreated.value = hastreat;
		}
		return body;
	}
	
	public void treatMultipart(HttpServletRequest request, String contentType) throws Exception {
		if(isMultipart(contentType)){
			List<MultipartObject> parts = new ArrayList<MultipartObject>();
			MultiValueMap<String, MultipartFile> filemap;
			if(request instanceof DefaultMultipartHttpServletRequest) {
				DefaultMultipartHttpServletRequest multipartReq = (DefaultMultipartHttpServletRequest)request;
				filemap = multipartReq.getMultiFileMap();
			}else {
				CommonsMultipartResolver resolver = new CommonsMultipartResolver(request.getServletContext());				
				MultipartHttpServletRequest multirequest = resolver.resolveMultipart(request);
				filemap = multirequest.getMultiFileMap();
			}
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
				Collection<Part> rawparts = request.getParts();
				for(Part part : rawparts){
					MultipartObject mpart = new MultipartObject();
					mpart.data = new TransData.MultipartData(part.getInputStream(), part.getName(), part.getSubmittedFileName());
					mpart.fieldName = part.getName();
					parts.add(mpart);
				}
			}
			TransData.setMultiparts(parts);
		}		
	}
	
	private boolean isMultipart(String contentType) {
		if(contentType != null && contentType.toLowerCase().startsWith("multipart/form-data;")) {
			return true;
		}
		return false;
	}

	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
		TransData.pureClearTransData();
		TransData.setRequestObject(request, response);
		
		Map<String, Object> header = new HashMap<String, Object>();
		Map<String, Object> args = genArgs(request, header);
		String body = null;
		String conttype = (String) header.get("content-type");
		try{
			boolean isjson = true;
			OutParameter<Boolean> hastreated = new OutParameter<Boolean>();
			hastreated.value = false;
			body = decodeHeadAndBody(args, header, conttype, response, hastreated);
			
			if(!isMultipart(conttype)) {
				byte[] data = FileUtility.getBytesFromStream(request.getInputStream());
				if(data != null && data.length > 0) {
					body = new String(data, "UTF-8");
					body = decrypt(response, header, body, conttype);
					request.setAttribute(KeyConstants.PlainBody, body);
					try{
						Map<String, Object> map = JsonUtility.toDictionary(body);
						args.putAll(map);
					}catch(Exception e){
						QueueLog.error(AppLoggers.ErrorLogger, e.getMessage());
						isjson = false;
					}
				}else {
					request.setAttribute(KeyConstants.PlainBody, "");
					if(!hastreated.value) {
						checkRSA(response, header);					
					}
				}
				
				if(!isjson) {
					String[] parts = StringUtility.splitString(body, '&');
					if(parts.length > 1){
						for(String arg : parts){
							String[] kv = StringUtility.splitString(arg, '=');
							if(kv.length == 2){
								args.put(kv[0], URLDecoder.decode(kv[1], "UTF-8"));
							}
						}
					}				
				}				
			}
			
		}catch(DecryptTimeoutException e){
			throw e;
		}catch(DecryptException e){
			throw e;
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e.getMessage());
		}
				
		TransData.setRequestData(header, args);
		
		if(logRawData) {
			QueueLog.debug(reqBodyLogger, "transcode:{}, after decrypt, body:\n{}\n",TransData.getTransCode(), TransData.getNoRestTransCode(), body);					
		}
		
		checkSignature(request, header, body);

		treatMultipart(request, conttype);		
		
		return true;
	}
	
	@Override
	public void postHandle(HttpServletRequest request, HttpServletResponse response, Object handler, ModelAndView modelAndView) throws Exception {

	}
	
	public void complete(HttpServletRequest request, HttpServletResponse response)throws Exception{
		if(TransData.isSSE()) {
			response.setContentType("text/event-stream;charset=UTF-8");
	        TransData.clearTransData();
			return;
		}
		
		response.setContentType("application/json; charset=UTF-8");
		
		ResponseRawData responseRaw = TransData.getRawDataResponse();
		if(responseRaw != null) {
			ServletOutputStream sos = response.getOutputStream();
	        String filename = responseRaw.filename;
	        if(StringUtility.isNullOrEmpty(filename)) {
	        	filename = StringUtility.getUUID();
	        }
	        filename = new String(filename.getBytes("UTF-8"), "ISO8859-1");
	        FileType ctype = responseRaw.contentType;
	        if(ctype == null) {
	        	ctype = FileType.PNG;
	        }
	        String conttype = ctype.getContentType();
	        response.setHeader("content-type", conttype);
	        response.setHeader("content-disposition", "attachment;filename="+filename);
	        response.setHeader("RawData", "1");
	        response.setContentType(conttype);
	        sos.write(responseRaw.data);

	        TransData.clearTransData();
	        response.flushBuffer();
			return;
		}
		
		String htmlFragment = TransData.getHtmlFragment();
		if(!StringUtility.isNullOrEmpty(htmlFragment)) {
			ServletOutputStream sos = response.getOutputStream();
			String conttype = "text/html; charset=UTF-8";
	        response.setHeader("content-type", conttype);
	        response.setContentType(conttype);
	        byte[] raw = htmlFragment.getBytes("UTF-8");
	        sos.write(raw);

	        TransData.clearTransData();
	        response.flushBuffer();
			return;
		}
		
		Map<String, Object> header = TransData.getRequestHeader();
		Object obj = TransData.getResponseData();
		if(rawData) {
			if(StringUtility.isNullOrEmpty(obj)) {
				TransData.clearTransData();
				response.flushBuffer();
				return;						
			}
			if(obj instanceof String || obj instanceof Long || obj instanceof Double || obj instanceof Float || 
					obj instanceof Integer || obj instanceof Short || obj instanceof Byte || obj instanceof Boolean || 
					obj.getClass().isPrimitive() || obj instanceof BigDecimal || 
					obj instanceof LocalDateTime || obj instanceof Date || obj instanceof BigInteger) {
				response.addHeader("SimpleData", "1");
				response.setHeader("SimpleData", "1");
				String rspdata = null;
				if(obj instanceof Date) {
					rspdata = FormatUtility.formatDateTime((Date)obj, "yyyy-MM-DD HH:mm:ss");
				}else if(obj instanceof LocalDateTime) {
					rspdata = FormatUtility.formatDateTime((LocalDateTime)obj, "yyyy-MM-DD HH:mm:ss");
				}else {
					rspdata = obj.toString();
				}
				rspdata = encrypt(rspdata, response, header);
				response.getOutputStream().write(rspdata.getBytes("UTF-8"));	
			}else {
				String json;
				if(encodePretty){
					json = JsonUtility.encodePretty(obj);
				}else{
					json = JsonUtility.encode(obj);
				}
				json = encrypt(json, response, header);
				response.getOutputStream().write(json.getBytes("UTF-8"));						
			}

			TransData.clearTransData();
			response.flushBuffer();
			return;
		}
		
		Map<String, Object> map = ResultConvertor.convertResult(obj);
		
		if(StringUtility.isNullOrEmpty(ResultKey)){
			if(StringUtility.isNullOrEmpty(obj)){
				return;
			}
			if(obj instanceof String){
				String str = (String) obj;
				str = encrypt(str, response, header);
				response.setContentType("application/octet-stream; charset=UTF-8");

				TransData.clearTransData();
				response.getOutputStream().write(str.getBytes("UTF-8"));
				response.flushBuffer();
			}else{
				String json;
				if(encodePretty){
					json = JsonUtility.encodePretty(map);
				}else{
					json = JsonUtility.encode(map);
				}
				json = encrypt(json, response, header);

				TransData.clearTransData();
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
		json = encrypt(json, response, header);
		
		TransData.clearTransData();		
		response.getOutputStream().write(json.getBytes("UTF-8"));
		response.flushBuffer();		
	}
		
	@Override
	public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) throws Exception {
		boolean exptOccured = ConvertUtility.getValueAsBool(request.getAttribute(KeyConstants.AttrExceptionOccured), false);
		if(ex != null || exptOccured){
			return;
		}
		
		Map<String, Object> responseheadmap = TransData.getAllResponseHeaders();
		for(Map.Entry<String, Object> entry : responseheadmap.entrySet()){
			String key = entry.getKey();
			Object obj = entry.getValue();
			response.setHeader(key, ConvertUtility.getValueAsString(obj));
		}

		response.setHeader(KeyConstants.ResultCode, KeyConstants.SuccessCode + "");
		response.setHeader(KeyConstants.ResultMessage, "");

		if(handler == null) {
			complete(request, response);
		}else {
			if(TransData.isSSE()) {
				response.setContentType("text/event-stream;charset=UTF-8");
		        TransData.clearTransData();
				return;
			}else if(TransData.isNoRestful()) {
				complete(request, response);
			}else if(handler instanceof HandlerMethod){
				HandlerMethod mhandler = (HandlerMethod)handler;
				MethodParameter p = mhandler.getReturnType();
				Class t = p.getParameterType();
				String n = t.getName();
				if(n.equalsIgnoreCase("void")){
					complete(request, response);
				}
			}			
		}
	}

}
