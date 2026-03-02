package boundless.web.help;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import boundless.spring.help.PropertyPlaceholder;
import boundless.types.ICache;
import boundless.utility.ConvertUtility;

public interface TokenManager {
	public static final int MobileError = -4;	
	public static final int TokenError = -3;
	public static final int MissTokenParam = -2;
	public static final int TokenTimeOut = -1;
	public static final int TokenNotCreated = 0;
	public static final int TokenFound = 1;
	
	
	public Token createToken(HttpServletRequest request, HttpServletResponse response, ICache cache);
	public Token createToken(HttpServletRequest request, HttpServletResponse response, String mobile, ICache cache);
	public int verifyToken(HttpServletRequest request, ICache cache);
	public int verifyToken(HttpServletRequest request, String mobile, ICache cache);
	public void clearToken(HttpServletRequest request, ICache cache);
	public String tokenListName();
	public String tokenMsg(int code);
}
