package spacex.astrostudytest;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

import boundless.io.FileUtility;
import boundless.net.http.HttpClientUtility;
import boundless.net.http.HttpClientUtility.MultiPartContent;
import boundless.security.SignatureUtility;
import boundless.security.SimpleWebSocketSecUtility;
import boundless.spring.help.PropertyPlaceholder;
import boundless.spring.help.interceptor.KeyConstants;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;
import spacex.basecomm.constants.ClientApp;
import spacex.basecomm.constants.ClientChannel;

public class HttpClientTest {
	private String ver = "0.1";
	private ClientChannel channel = ClientChannel.PC;
	private String app = PropertyPlaceholder.getProperty("clientapp", "100");
	
	private String rootUrl;
	private String user;
	private String password;
	private String loginUrl;
	private String signkey;
	
	private String customerId;
	private String cusloginUrl;
	
	private boolean rspEncrypt = PropertyPlaceholder.getPropertyAsBool("reqencrypt", false);
	private String webRsaModulus = PropertyPlaceholder.getProperty("webencrypt.rsa.modulus", "");
	private String webRsaPubExp = PropertyPlaceholder.getProperty("webencrypt.rsa.publicexp", "");
	
	static{
		PropertyPlaceholder.addPropperties("classpath:conf/params.properties");
	}
	
	public HttpClientTest(){
		this(PropertyPlaceholder.getProperty("login.url"), 
				PropertyPlaceholder.getProperty("login.user"), 
				PropertyPlaceholder.getProperty("login.pwd"), 
				PropertyPlaceholder.getProperty("cuslogin.customer"), 
				PropertyPlaceholder.getProperty("cuslogin.url"));
	}
	
	public HttpClientTest(String loginUrl, String user, String password, String customerId, String cusloginUrl){
		this.loginUrl = loginUrl;
		this.user = user;
		this.password = password;
		this.customerId = customerId;
		this.cusloginUrl = cusloginUrl;
		
		this.signkey = PropertyPlaceholder.getProperty("signature.sha256key", "6928FB6E2928");
	}
	
	private String decrypt(String body, Map<String, String> responseHeaders){
		try {
			if(StringUtility.isNullOrEmpty(body) ||
					StringUtility.isNullOrEmpty(webRsaModulus) || StringUtility.isNullOrEmpty(webRsaPubExp)) {
				return body;
			}
			String enc = responseHeaders.get("Encrypted");
			if(StringUtility.isNullOrEmpty(enc) || !enc.equals("1")) {
				return body;
			}				
			byte[] raw = SimpleWebSocketSecUtility.decrypt(body, webRsaModulus, webRsaPubExp);
			return new String(raw, "UTF-8");			
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}
	
	private String encrypt(String str) {
		try {
			if(!rspEncrypt || StringUtility.isNullOrEmpty(str) ||
					StringUtility.isNullOrEmpty(webRsaModulus) || StringUtility.isNullOrEmpty(webRsaPubExp)) {
				return str;
			}
			
			byte[] raw = str.getBytes("UTF-8");
			String encoded = SimpleWebSocketSecUtility.encrypt(raw, webRsaModulus, webRsaPubExp, new Date());
			return encoded;			
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}
	
	private String getSignHeader(){
		String hd = String.format("%d%s%s", channel.getCode(), app, ver);
		return hd;
	}
	
	private String login(Map<String, String> reqheaders){
		Map<String, String> headers = reqheaders;
		if(headers == null) {
			headers = new HashMap<String, String>();
		}
		headers.put("ClientChannel", channel.getCode() + "");
		headers.put("ClientApp", app);
		headers.put("ClientVer", ver);
		
		Map<String, String> responseHeaders = new HashMap<String, String>();
		Map<String, Object> loginparams = new HashMap<String, Object>();
		loginparams.put("LoginId", user);
		loginparams.put("Pwd", password);
		
		String paramtxt = JsonUtility.encode(loginparams);
		String txtdata = String.format("%s%s%s", this.signkey, getSignHeader(), paramtxt);
		String loginsigntxt = SignatureUtility.sha256Signature(txtdata);
		headers.put(KeyConstants.Signature, loginsigntxt);
		
		String str = encrypt(paramtxt);
		String json = HttpClientUtility.uploadString(this.loginUrl, headers, "application/json; charset=UTF-8", str, responseHeaders);
		json = decrypt(json, responseHeaders);
		Map<String, Object> map = JsonUtility.toDictionary(json);
		Map<String, Object> res = (Map<String, Object>) map.get("Result");
		
		String token = ConvertUtility.getValueAsString(res.get(KeyConstants.Token));
		return token;
	}
	
	private String cuslogin(Map<String, String> reqheaders){
		Map<String, String> headers = reqheaders;
		if(headers == null) {
			headers = new HashMap<String, String>();
		}
		headers.put("ClientChannel", channel.getCode() + "");
		headers.put("ClientApp", app);
		headers.put("ClientVer", ver);
		
		Map<String, String> responseHeaders = new HashMap<String, String>();
		Map<String, Object> loginparams = new HashMap<String, Object>();
		loginparams.put("LoginId", user);
		loginparams.put("Pwd", password);
		loginparams.put("CustomerId", this.customerId);
		
		String paramtxt = JsonUtility.encode(loginparams);
		String txtdata = String.format("%s%s%s", this.signkey, getSignHeader(), paramtxt);
		String loginsigntxt = SignatureUtility.sha256Signature(txtdata);
		headers.put(KeyConstants.Signature, loginsigntxt);
		
		String str = encrypt(paramtxt);
		String json = HttpClientUtility.uploadString(this.cusloginUrl, headers, "application/json; charset=UTF-8", str, responseHeaders);
		json = decrypt(json, responseHeaders);
		Map<String, Object> map = JsonUtility.toDictionary(json);
		Map<String, Object> res = (Map<String, Object>) map.get("Result");
		
		String token = ConvertUtility.getValueAsString(res.get(KeyConstants.Token));
		return token;
	}
	
	public String post(String url, Map<String, Object> params, Map<String, String> reqHeadMap, Map<String, String> respHeadMap) {
		String token = login(reqHeadMap);		
		return post(url, token, params, reqHeadMap, respHeadMap);
	}
	
	public String postNoLogin(String url) {
		return post(url, "", new HashMap<String, Object>(), null, null);
	}
	
	public String postNoLogin(String url, Map<String, Object> params, Map<String, String> reqHeadMap, Map<String, String> respHeadMap) {
		return post(url, "", params, reqHeadMap, respHeadMap);
	}
	
	public String cuspost(String url, Map<String, Object> params, Map<String, String> reqHeadMap, Map<String, String> respHeadMap) {
		String token = cuslogin(reqHeadMap);		
		return post(url, token, params, reqHeadMap, respHeadMap);
	}
	
	public byte[] cusexport(String url, Map<String, Object> params, Map<String, String> reqHeadMap, Map<String, String> respHeadMap) {
		String token = cuslogin(reqHeadMap);		
		return export(url, token, params, reqHeadMap, respHeadMap);
	}
	
	public String post(String url, String token,  Map<String, Object> params, Map<String, String> reqHeadMap, Map<String, String> respHeadMap){
		Map<String, String> headers = reqHeadMap;
		if(headers == null) {
			headers = new HashMap<String, String>();
		}
		headers.put(KeyConstants.Token, token);
		headers.put("ClientChannel", channel.getCode() + "");
		headers.put("ClientApp", app);
		headers.put("ClientVer", ver);			
		
		boolean hasmultipart = false;
		List<MultiPartContent> multiparts = new ArrayList<MultiPartContent>(params.size());
		for(Map.Entry<String, Object> entry : params.entrySet()){
			String key = entry.getKey();
			Object obj = entry.getValue();
			MultiPartContent multi = null;
			if(obj instanceof InputStream){
				hasmultipart = true;
				multi = HttpClientUtility.createMultiPart(key, (InputStream)obj);
			}else{
				multi = HttpClientUtility.createMultiPart(key, obj.toString());
			}
			multiparts.add(multi);
		}
		
		Map<String, String> respHMap = respHeadMap;
		if(respHMap == null) {
			respHMap = new HashMap<String, String>();
		}
		String json = null;
		if(hasmultipart){
			String txt = String.format("%s%s%s", token, this.signkey, getSignHeader());
			String signtxt = SignatureUtility.sha256Signature(txt);
			headers.put(KeyConstants.Signature, signtxt);
			
			long ms = System.currentTimeMillis();
			byte[] raw = HttpClientUtility.httpPostMultiPart(url, headers, respHMap, multiparts);
			long ms1 = System.currentTimeMillis();
			System.out.println(String.format("execute ms: %d", ms1-ms));
			try {
				json = new String(raw, "UTF-8");
				json = decrypt(json, respHMap);
			} catch (Exception e) {
				throw new RuntimeException(e);
			}
		}else{
			String jsonData = JsonUtility.encode(params);
			String txt = String.format("%s%s%s%s", token, this.signkey, getSignHeader(), jsonData);
			String signtxt = SignatureUtility.sha256Signature(txt);
			headers.put(KeyConstants.Signature, signtxt);
			
			String str = encrypt(jsonData);
			long ms = System.currentTimeMillis();
			json = HttpClientUtility.uploadString(url, headers, "application/json; charset=UTF-8", str, respHMap);
			long ms1 = System.currentTimeMillis();
			System.out.println(String.format("execute ms: %d", ms1-ms));
			json = decrypt(json, respHMap);
		}
		
		return json;
	}
	
	public byte[] export(String url, String token,  Map<String, Object> params, Map<String, String> reqHeadMap, Map<String, String> respHeadMap){
		Map<String, String> headers = reqHeadMap;
		if(headers == null) {
			headers = new HashMap<String, String>();
		}
		headers.put(KeyConstants.Token, token);
		headers.put("ClientChannel", channel.getCode() + "");
		headers.put("ClientApp", app);
		headers.put("ClientVer", ver);			
		
		boolean hasmultipart = false;
		List<MultiPartContent> multiparts = new ArrayList<MultiPartContent>(params.size());
		for(Map.Entry<String, Object> entry : params.entrySet()){
			String key = entry.getKey();
			Object obj = entry.getValue();
			MultiPartContent multi = null;
			if(obj instanceof InputStream){
				hasmultipart = true;
				multi = HttpClientUtility.createMultiPart(key, (InputStream)obj);
			}else{
				multi = HttpClientUtility.createMultiPart(key, obj.toString());
			}
			multiparts.add(multi);
		}
		
		Map<String, String> respHMap = respHeadMap;
		if(respHMap == null) {
			respHMap = new HashMap<String, String>();
		}
		if(hasmultipart){
			String txt = String.format("%s%s%s", token, this.signkey, getSignHeader());
			String signtxt = SignatureUtility.sha256Signature(txt);
			headers.put(KeyConstants.Signature, signtxt);
			
			byte[] raw = HttpClientUtility.httpPostMultiPart(url, headers, respHMap, multiparts);
			return raw;
		}else{
			String jsonData = JsonUtility.encode(params);
			String txt = String.format("%s%s%s%s", token, this.signkey, getSignHeader(), jsonData);
			String signtxt = SignatureUtility.sha256Signature(txt);
			headers.put(KeyConstants.Signature, signtxt);
			try {
				String str = encrypt(jsonData);
				byte[] data = str.getBytes("UTF-8");
				byte[] raw = HttpClientUtility.httpPostToBytes(url, data, headers, "application/json; charset=UTF-8", respHMap);
				return raw;				
			}catch(Exception e) {
				throw new RuntimeException(e);
			}
		}
	}
	
	public String post(String url, Map<String, Object> params) {
		return post(url, params, null, null);
	}
	
	public String cuspost(String url, Map<String, Object> params) {
		return cuspost(url, params, null, null);
	}
	
	public byte[] cusexport(String url, Map<String, Object> params) {
		return cusexport(url, params, null, null);
	}
	
	public String post(String url, List<MultiPartContent> multiparts){
		Map<String, String> headers = new HashMap<String, String>();
		String token = login(headers);		
		headers.put(KeyConstants.Token, token);
		
		String txt = String.format("%s%s%s", token, this.signkey, getSignHeader());
		String signtxt = SignatureUtility.sha256Signature(txt);
		headers.put(KeyConstants.Signature, signtxt);
		
		Map<String, String> respheaders = new HashMap<String, String>();
		long ms = System.currentTimeMillis();
		byte[] raw = HttpClientUtility.httpPostMultiPart(url, headers, respheaders, multiparts);
		long ms1 = System.currentTimeMillis();
		System.out.println(String.format("execute ms: %d", ms1-ms));
		try{
			String resp = new String(raw, "UTF-8");
			resp = decrypt(resp, respheaders);
			return resp;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public String cuspost(String url, List<MultiPartContent> multiparts){
		Map<String, String> headers = new HashMap<String, String>();
		String token = cuslogin(headers);		
		headers.put(KeyConstants.Token, token);
		
		String txt = String.format("%s%s%s", token, this.signkey, getSignHeader());
		String signtxt = SignatureUtility.sha256Signature(txt);
		headers.put(KeyConstants.Signature, signtxt);
		
		Map<String, String> respheaders = new HashMap<String, String>();
		long ms = System.currentTimeMillis();
		byte[] raw = HttpClientUtility.httpPostMultiPart(url, headers, respheaders, multiparts);
		long ms1 = System.currentTimeMillis();
		System.out.println(String.format("execute ms: %d", ms1-ms));
		try{
			String resp = new String(raw, "UTF-8");
			resp = decrypt(resp, respheaders);
			return resp;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public String upload(String urlprefix, String filename){
		List<MultiPartContent> multiparts = new LinkedList<MultiPartContent>();
		int idx = filename.lastIndexOf('.');
		String ext = filename.substring(idx+1);
		InputStream thzhins = FileUtility.getInputStreamFromFile(filename);
		
		MultiPartContent multi = HttpClientUtility.createMultiPart("TestImg",  thzhins, String.format("testimg.%s", ext));
		multiparts.add(multi);
		try{
			String json = post(urlprefix + "/upload/img", multiparts);
			Map<String, Object> map = JsonUtility.toDictionary(json);
			Map<String, Object> res = (Map<String, Object>) map.get("Result");
			String imgurl = (String) res.get("TestImg");
			return imgurl;			
		}finally{
			try {
				thzhins.close();
			} catch (IOException e) {
				e.printStackTrace();
			}
		}
		
	}
	
	public String cusupload(String urlprefix, String filename){
		List<MultiPartContent> multiparts = new LinkedList<MultiPartContent>();
		int idx = filename.lastIndexOf('.');
		String ext = filename.substring(idx+1);
		InputStream thzhins = FileUtility.getInputStreamFromFile(filename);
		
		MultiPartContent multi = HttpClientUtility.createMultiPart("TestImg",  thzhins, String.format("testimg.%s", ext));
		multiparts.add(multi);
		try{
			String json = cuspost(urlprefix + "/upload/img", multiparts);
			Map<String, Object> map = JsonUtility.toDictionary(json);
			Map<String, Object> res = (Map<String, Object>) map.get("Result");
			String imgurl = (String) res.get("TestImg");
			return imgurl;			
		}finally{
			try {
				thzhins.close();
			} catch (IOException e) {
				e.printStackTrace();
			}
		}
		
	}
	
	public Map<String, Object> cuslogin() {
		Map<String, String> headers = new HashMap<String, String>();
		headers.put("ClientChannel", channel.getCode() + "");
		headers.put("ClientApp", app);
		headers.put("ClientVer", ver);
		
		Map<String, String> responseHeaders = new HashMap<String, String>();
		Map<String, Object> loginparams = new HashMap<String, Object>();
		loginparams.put("LoginId", user);
		loginparams.put("Pwd", password);
		loginparams.put("CustomerId", this.customerId);
		loginparams.put("NeedMenu", true);
		
		String paramtxt = JsonUtility.encode(loginparams);
		String txtdata = String.format("%s%s%s", this.signkey, getSignHeader(), paramtxt);
		String loginsigntxt = SignatureUtility.sha256Signature(txtdata);
		headers.put(KeyConstants.Signature, loginsigntxt);
		
		String json = HttpClientUtility.uploadString(this.cusloginUrl, headers, "application/json; charset=UTF-8", paramtxt);
		Map<String, Object> map = JsonUtility.toDictionary(json);
		Map<String, Object> res = (Map<String, Object>) map.get("Result");
		
		return res;
	}
	
}
