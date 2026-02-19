package spacex.astrostudy.controller;

import java.io.ByteArrayOutputStream;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ParamsIllegalException;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.security.SecurityUtility;
import boundless.spring.help.PropertyPlaceholder;
import boundless.spring.help.interceptor.TransData;
import boundless.types.ICache;
import boundless.utility.StringUtility;
import boundless.web.help.ImageTokenGenerator;
import boundless.web.help.Token;
import boundless.web.help.TokenManager;
import boundless.web.help.TokenManagerImp;
import spacex.astrostudy.helper.AstroCacheHelper;
import spacex.basecomm.helper.NotificationHelper;

@Controller
@RequestMapping("/common")
public class TokenController {

	private static TokenManager tokenManager = new TokenManagerImp();
	private static TokenManager smsTokenManager = new TokenManagerImp();

    private static void initTokenManager(){
		int timeout = TokenManagerImp.ImageTokenTimeout;
		int tokenlength = TokenManagerImp.ImageTokenLength;
		boolean ignorecase = TokenManagerImp.ImageTokenIgnoreCase;
		boolean numeric = TokenManagerImp.ImageTokenNumeric;
		TokenManagerImp mgmt = (TokenManagerImp) tokenManager;
		mgmt.timeout(timeout);
		mgmt.tokenlength(tokenlength);
		mgmt.ignoreCase(ignorecase);
		mgmt.numeric(numeric);
		
		String lisname = TokenManagerImp.ImageTokenListName;
		String tokenname = TokenManagerImp.ImageTokenName;
		if(!StringUtility.isNullOrEmpty(lisname)){
			mgmt.tokenListName(lisname);
		}
		if(!StringUtility.isNullOrEmpty(tokenname)){
			mgmt.tokenName(tokenname);
		}else {
			mgmt.tokenName("ImgToken");
		}
	}
    
    private static void initSmsTokenManager(){
		int timeout = PropertyPlaceholder.getPropertyAsInt("smstoken.timeout", 120);
		int tokenlength = PropertyPlaceholder.getPropertyAsInt("smstoken.length", 4);
		boolean ignorecase = PropertyPlaceholder.getPropertyAsBool("smstoken.ignorecase", true);
		boolean numeric = PropertyPlaceholder.getPropertyAsBool("smstoken.numeric", true);
		TokenManagerImp mgmt = (TokenManagerImp) smsTokenManager;
		mgmt.timeout(timeout);
		mgmt.tokenlength(tokenlength);
		mgmt.ignoreCase(ignorecase);
		mgmt.numeric(numeric);
		
		String lisname = PropertyPlaceholder.getProperty("smstoken.listname", "_SMSTOKENLIST");
		String tokenname = PropertyPlaceholder.getProperty("smstoken.forminputname", "_smsTokenName");
		if(!StringUtility.isNullOrEmpty(lisname)){
			mgmt.tokenListName(lisname);
		}
		if(!StringUtility.isNullOrEmpty(tokenname)){
			mgmt.tokenName(tokenname);
		}else {
			mgmt.tokenName("SmsToken");
		}
	}
    
    static{
    	initTokenManager();
    	initSmsTokenManager();
    }
    
    public static void verifyImageToken(HttpServletRequest request){
		ICache cache = AstroCacheHelper.getCommCache();
    	int code = tokenManager.verifyToken(request, cache);
    	if(code != TokenManager.TokenFound){
    		throw new ParamsIllegalException("imgtoken.error." + code);
    	}
    }
    
	@RequestMapping("/imageToken")
	@ResponseBody
    public String imageToken(HttpServletRequest request, HttpServletResponse response){
		ICache cache = AstroCacheHelper.getCommCache();
    	String res = "";
    	Token token = tokenManager.createToken(request, response, cache);
    	try(ByteArrayOutputStream os = new ByteArrayOutputStream()){
    		ImageTokenGenerator.createPic(os, token.uniqueId());
    		res = SecurityUtility.base64(os.toByteArray());
    	} catch (Exception e) {
    		QueueLog.error(AppLoggers.ErrorLogger, e);
    		res = "";
		}
    	return res;
    }
	
	@RequestMapping("/imgToken")
	@ResponseBody
    public void imgToken(HttpServletRequest request, HttpServletResponse response){
		ICache cache = AstroCacheHelper.getCommCache();
    	String res = "";
    	Token token = tokenManager.createToken(request, response, cache);
    	try(ByteArrayOutputStream os = new ByteArrayOutputStream()){
    		ImageTokenGenerator.createPic(os, token.uniqueId());
    		res = SecurityUtility.base64(os.toByteArray());
    	} catch (Exception e) {
    		QueueLog.error(AppLoggers.ErrorLogger, e);
    		res = "";
		}
    	
    	TransData.set("TokenImg", res);
    	TransData.set(tokenManager.tokenListName(), response.getHeader(tokenManager.tokenListName()));
    }
	
	@RequestMapping("/smsToken")
	@ResponseBody
	public void smsToken(HttpServletRequest request, HttpServletResponse response){
		ICache cache = AstroCacheHelper.getCommCache();
		String receiver = TransData.getValueAsString("Receiver");
		if(StringUtility.isNullOrEmpty(receiver)){
			throw new ParamsIllegalException("receiver.is.null");
		}
		
		Token token = smsTokenManager.createToken(request, response, receiver, cache);
		String msg = PropertyPlaceholder.getProperty("smstoken.msg", new Object[]{ token.uniqueId() });
		NotificationHelper.sendSms(receiver, msg);
	}
	    
    public static void verifySmsToken(HttpServletRequest request, String mobile){
		ICache c = AstroCacheHelper.getCommCache();
    	int code = smsTokenManager.verifyToken(request, mobile, c);
    	if(code != TokenManager.TokenFound){
    		throw new ParamsIllegalException("smstoken.error." + code);
    	}
    }
        
}
