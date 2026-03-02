package boundless.web.help;



import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.slf4j.Logger;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.spring.help.PropertyPlaceholder;
import boundless.spring.help.interceptor.TransData;
import boundless.types.ICache;
import boundless.types.OutParameter;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class TokenManagerImp implements TokenManager {	
	private static Logger log = AppLoggers.getLog("error", "imgtoken");
	
	private int _timeout = 15;
	private int _maxEntryNumber = 3;
	private int _tokenLength = 6;
	private String _tokenListName = "ImgTokenListName";
	private String _tokenName = "ImgToken";
	private boolean _ignoreCase = true;
	private boolean _numeric = false;
	
	public static int ImageTokenTimeout;
	public static int ImageTokenLength;
	public static boolean ImageTokenIgnoreCase;
	public static boolean ImageTokenNumeric;
	public static String ImageTokenListName;
	public static String ImageTokenName;
	
	private static final String ImageTokenListNameKey = "web.imagetoken.listname";
	private static final String ImageTokenNameKey = "web.imagetoken.forminputname";
	private static final String TokenPrefixed = "tokenlist:";
	private static final String SmsTokenMobilePrefixed = "smstokenmobile:";

	static{
		ImageTokenTimeout = ConvertUtility.getValueAsInt(PropertyPlaceholder.getProperty("web.imagetoken.timeout"));
		ImageTokenLength = ConvertUtility.getValueAsInt(PropertyPlaceholder.getProperty("web.imagetoken.length"));
		ImageTokenIgnoreCase = ConvertUtility.getValueAsBool(PropertyPlaceholder.getProperty("web.imagetoken.ignorecase"), true);
		ImageTokenNumeric = ConvertUtility.getValueAsBool(PropertyPlaceholder.getProperty("web.imagetoken.numeric"), true);
		ImageTokenListName = PropertyPlaceholder.getProperty(ImageTokenListNameKey);
		ImageTokenName = PropertyPlaceholder.getProperty(ImageTokenNameKey);
		
		if(ImageTokenTimeout <= 0){
			ImageTokenTimeout = 120;
		}
		
		if(StringUtility.isNullOrEmpty(ImageTokenListName) || ImageTokenListName.equals(ImageTokenListNameKey)){
			ImageTokenListName = "_IMGTOKENLIST";
		}
		if(StringUtility.isNullOrEmpty(ImageTokenName) || ImageTokenName.equals(ImageTokenNameKey)){
			ImageTokenName = "_imgTokenName";
		}
				
	}
	
	
	public TokenManagerImp(){
		this(15, 6, true, false);
	}
	
	public TokenManagerImp(int timeout, int length, boolean ignoreCase, boolean numeric){
		this._timeout = timeout;
		this._tokenLength = length;
		this._ignoreCase = ignoreCase;
		this._numeric = numeric;
	}
	
	public void tokenListName(String name){
		_tokenListName = name;
	}
	public String tokenListName(){
		return _tokenListName;
	}
	
	public void tokenName(String name){
		_tokenName = name;
	}
	
	public void maxEntryNumber(int size){
		_maxEntryNumber = size;
	}
	
	public void timeout(int timeout){
		_timeout = timeout;
	}
	
	public void tokenlength(int length){
		_tokenLength = length;
	}
	
	public void ignoreCase(boolean flag){
		_ignoreCase = flag;
	}
	
	public void numeric(boolean flag){
		_numeric = flag;
	}
	
	private String getTokenKeyInCache(String tokenkey){
		return TokenPrefixed + tokenkey;
	}
	
	public void clearToken(HttpServletRequest request, ICache cache){
		String tokenkey = request.getHeader(_tokenListName);
		cache.remove(getTokenKeyInCache(tokenkey));
	}
	
	public Token createToken(HttpServletRequest request, HttpServletResponse response, ICache cache){
		if(this._tokenLength <= 0){
			return new TokenImp("", System.currentTimeMillis());
		}
		
		String tokenkey = request.getHeader(_tokenListName);
		if(StringUtility.isNullOrEmpty(tokenkey)){
			tokenkey = StringUtility.getUUID();
		}
		response.setHeader(_tokenListName, tokenkey);
		
		TokenList list = null;
		String keyIncache = getTokenKeyInCache(tokenkey);
		String json = (String)cache.get(keyIncache);
		if(StringUtility.isNullOrEmpty(json)){
			list = new TokenList(_maxEntryNumber, _timeout, _tokenLength, _numeric);
		}else{
			list = JsonUtility.decode(json, TokenList.class);
		}
		
		String tokenid = list.getNextTokenId();
		if(_ignoreCase){
			tokenid = tokenid.replace("0", "1").replace("o", "p").replace("1", "2").replace("l", "m").replace("g", "h").replace("9", "8");
			tokenid = tokenid.toLowerCase();
		}
		TokenImp token = new TokenImp(tokenid, System.currentTimeMillis());
		list.add(token);
		request.setAttribute(_tokenName, token.uniqueId());
		
		cache.put(keyIncache, JsonUtility.encode(list), _timeout);
		
		return token;
	}
	
	public Token createToken(HttpServletRequest request, HttpServletResponse response, String mobile, ICache cache) {
		Token token = createToken(request, response, cache);
		cache.put(SmsTokenMobilePrefixed + token.uniqueId(), mobile, _timeout);
		return token;
	}
	
	private int findToken(HttpServletRequest request, ICache cache, OutParameter<Token> out) {
		if(this._tokenLength <= 0){
			return TokenFound;
		}
		
		String tokenkey = request.getHeader(_tokenListName);
		String keyIncache = getTokenKeyInCache(tokenkey);
		String json = (String) cache.get(keyIncache);
		if(StringUtility.isNullOrEmpty(json)){
			return TokenNotCreated;
		}
		
		TokenList list = JsonUtility.decode(json, TokenList.class);
		if(list == null){
			return TokenNotCreated;
		}
		String tokenid = request.getParameter(_tokenName);
		if(StringUtility.isNullOrEmpty(tokenid)){		
			tokenid = TransData.getValueAsString(_tokenName);
		}
		if(StringUtility.isNullOrEmpty(tokenid)){
			return MissTokenParam;
		}
		if(_ignoreCase){
			tokenid = tokenid.toLowerCase();
		}
		try{
			Token token = list.get(tokenid);
			out.value = token;
			if(token != null){
				return TokenFound;
			}else{
				return TokenError;
			}
		}catch(Exception e){
			QueueLog.error(log, e);
			return TokenTimeOut;
		}
		
	}
	
	public int verifyToken(HttpServletRequest request, ICache cache){
		OutParameter<Token> out = new OutParameter<Token>();
		return findToken(request, cache, out);
	}
	
	public int verifyToken(HttpServletRequest request, String mobile, ICache cache) {
		OutParameter<Token> out = new OutParameter<Token>();
		int code = findToken(request, cache, out);
		if(code == TokenFound) {
			if(out.value != null) {
				String tel = (String) cache.get(SmsTokenMobilePrefixed + out.value.uniqueId());
				if(StringUtility.isNullOrEmpty(tel) || !tel.equalsIgnoreCase(mobile)) {
					return TokenManager.MobileError;
				}
			}
		}
		return code;
	}
	
	public static enum TokenResult{
		TokenNotFound(-3), MissTokenParam(-2), TokenTimeOut(-1), TokenListNotExist(0), TokenFound(1);
		
		private int _code;
		private TokenResult(int code){
			_code = code;
		}
		
		public int code(){
			return _code;
		}
	}
	public String tokenMsg(int code){
		switch(code){
		case MobileError:
			return "手机号与验证码不一致";
		case TokenError:
			return "验证码错误";
		case TokenNotCreated:
			return "验证码未生成";
		case TokenTimeOut:
			return "验证码超时";
		case MissTokenParam:
			return "验证码为空";
		case TokenFound:
			return "验证码正确";
		}
		
		return "未知错误";
	}
}
