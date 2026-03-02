package boundless.web.help;

import javax.servlet.http.HttpServletRequest;

import boundless.spring.help.PropertyPlaceholder;
import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;

public class TransUrlUtility {
	public static final String PASS = "__pass__";
	
	private static final String AlwaysCommonKey = "web.request.alwayscommon";
	private static final String CommonPartKey = "web.request.commonpart";
	private static final String UserCommonPartKey = "web.request.usercommonpart";
	
	private static final String[] COMMONPASSPART;
	private static final String[] USERPASSPART;
	
	public static final boolean ALWAYSCOMMON;
	
	static{
		ALWAYSCOMMON = ConvertUtility.getValueAsBool(PropertyPlaceholder.getProperty(AlwaysCommonKey), false);
		
		String commonpart = PropertyPlaceholder.getProperty(CommonPartKey, "");
		if(StringUtility.isNullOrEmpty(commonpart) || commonpart.equals(CommonPartKey)){
			COMMONPASSPART = new String[]{
				"/common/", "/ctrls/", "/filtererror/", "/errorpage/", "/error/", "/login"
			};
		}else{
			COMMONPASSPART = StringUtility.splitString(commonpart, ',');
		}
		
		String usercommonpart = PropertyPlaceholder.getProperty(UserCommonPartKey, "");
		if(StringUtility.isNullOrEmpty(usercommonpart) || usercommonpart.equals(UserCommonPartKey)){
			USERPASSPART = new String[]{
				"/usercommon/", "/index", "/welcome"
			};
		}else{
			USERPASSPART = StringUtility.splitString(usercommonpart, ',');
		}
		
	}
	
	private static boolean isCommonPart(String url){
		for(String str : COMMONPASSPART){
			if(url.indexOf(str) > -1){
				return true;
			}
		}
		return false;
	}
	
	private static boolean isUserCommonPart(String url){
		for(String str : USERPASSPART){
			if(url.indexOf(str) > -1){
				return true;
			}
		}
		return false;
	}
	
	public static boolean isCommonPass(String url){
		if(ALWAYSCOMMON){
			return true;
		}
		
    	if(StringUtility.isNullOrEmpty(url)){
    		return true;
    	}
    	if(isCommonPart(url)){
    		return true;
    	}
    	
    	return false;
	}
	
	public static boolean isUserPass(String url){
    	if(isUserCommonPart(url)){
    		return true;
    	}
		
		return false;
	}
	

    public static boolean isCrossDomain(HttpServletRequest request){
		String cb = request.getParameter("callback");
		if(StringUtility.isNullOrEmpty(cb)){
			cb = request.getParameter("jsoncallback");
		}
		if(StringUtility.isNullOrEmpty(cb)){
			return false;
		}
		return true;
    }
    
    public static String getTransUrl(String url){
    	if(isCommonPass(url)){
    		return PASS;
    	}
    	return url;
    }
    
}
