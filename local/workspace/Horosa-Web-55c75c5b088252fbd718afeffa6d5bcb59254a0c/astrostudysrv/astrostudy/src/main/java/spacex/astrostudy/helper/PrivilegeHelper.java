package spacex.astrostudy.helper;

import java.util.Map;

import boundless.security.MD5Utility;
import boundless.spring.help.PropertyPlaceholder;
import boundless.spring.help.interceptor.TransData;
import boundless.types.ICache;
import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;
import boundless.web.common.IUser;
import spacex.astrostudy.model.AstroUser;

public class PrivilegeHelper {
	private static ICache commCache;
	private static ICache userCache;
	
	private static String TokenPrefix = PropertyPlaceholder.getProperty("privilege.tokencache.prefix", "spacex:token:");
	private static String LoginIdPrefix = PropertyPlaceholder.getProperty("privilege.tokencache.prefix", "spacex:loginid:");
	private static int TokenExpire = PropertyPlaceholder.getProperty("privilege.loginexpire", 31536000);

	private static boolean LoginMutualExclusive = PropertyPlaceholder.getPropertyAsBool("web.request.exclusivelogin", false);
	private static String TokenIpKeyPrefix = "tokenip:";
	
	public static final String PWD_SALT = PropertyPlaceholder.getProperty("privilege.pwdsalt", "as");
	
	static{
		userCache = AstroCacheHelper.getUserCache();
		commCache = AstroCacheHelper.getCommCache();
		
		if(userCache == null || commCache == null){
//			throw new RuntimeException("cannot find cache, server stop");
		}
		
	}

	public static String getPwdHash(String pwd){
		return MD5Utility.encryptWithSalt(pwd, PWD_SALT);
	}
	
	
	public static void cacheUser(IUser user) {
		String loginId = user.getLoginId();
		String loginIdKey = LoginIdPrefix + loginId;
		
		String token = (String)commCache.get(loginIdKey);
		if(StringUtility.isNullOrEmpty(token)) {
			token = StringUtility.getUUID();
		}
		user.setToken(token);			
		
		String tokenkey = TokenPrefix + token;
		commCache.put(tokenkey, user.getLoginId(), TokenExpire);
		commCache.put(loginIdKey, token, TokenExpire);
		
		String tokenipkey = TokenIpKeyPrefix + token;
		commCache.put(tokenipkey, TransData.getRealIp(), TokenExpire);
		
		userCache.setMap(loginId, user.toMap());
	}
	
	public static void clearToken(String token) {
		String tokenkey = TokenPrefix + token;
		commCache.remove(tokenkey);
		
		String tokenipkey = TokenIpKeyPrefix + token;
		commCache.remove(tokenipkey);
	}
	
	public static void saveUser(IUser user) {
		userCache.setMap(user.getLoginId(), user.toMap());
	}
	
	public static IUser getUser(String token) {
		if(LoginMutualExclusive){
			String ipkey = TokenIpKeyPrefix + token;
			String ip = (String) commCache.get(ipkey);
			if(ip != null){
				commCache.expire(ipkey, TokenExpire);
			}
			String realip = TransData.getRealIp();
			if(ip == null || !ip.equals(realip)){
				return null;
			}
		}
		
		String tokenkey = TokenPrefix + token;
		String loginid = (String)commCache.get(tokenkey);
		if(StringUtility.isNullOrEmpty(loginid)){
			return null;
		}
		String loginIdKey = LoginIdPrefix + loginid;
		commCache.expire(tokenkey, TokenExpire);
		commCache.expire(loginIdKey, TokenExpire);

		Map<String, Object> map = userCache.getMap(loginid);
		AstroUser user = AstroUser.fromMap(map);
		user.setToken(token);
		
		return user;
	}
		
	public static void main(String[] args) {
		String pwd = "Admin12345";
		
		
		String hash = getPwdHash(pwd);
		System.out.println(hash);
	}
	
}
