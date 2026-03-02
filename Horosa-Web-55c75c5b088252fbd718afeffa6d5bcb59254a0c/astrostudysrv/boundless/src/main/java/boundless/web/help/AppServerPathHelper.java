package boundless.web.help;

import javax.servlet.http.HttpServletRequest;

import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;

import boundless.spring.help.PropertyPlaceholder;
import boundless.utility.IPUtility;
import boundless.utility.StringUtility;

public class AppServerPathHelper {
	private static String externalIp;
	
	public static String getAppServerLocalPath(HttpServletRequest reques){
		return reques.getSession().getServletContext().getRealPath("/");
	}
	
	public static String getAppServerLocalPath(){
		  String str = AppServerPathHelper.class.getResource("/").getPath();
		  int i = str.indexOf("WEB-INF");
		  str = str.substring(0, i);
		  return str;
	}
	
	public static String getUrlRoot(HttpServletRequest reques){
		String ctxpath = reques.getContextPath();
		String url = reques.getRequestURL().toString();
		int idx = url.lastIndexOf(ctxpath);
		String urlroot = url.substring(0, idx);
		return urlroot;
	}
	
	public static String getAppRoot(HttpServletRequest request){
		StringBuilder appserver = new StringBuilder();
		appserver.append(request.getScheme()).append("://").append(request.getServerName());
    	if(request.getServerPort() != 80){
    		appserver.append(':').append(request.getServerPort());
    	}
    	return appserver.toString();
	}
	
	public static String getExternalIpProvider(){
		String prov = PropertyPlaceholder.getProperty("ExternalIpProvider");
		if(StringUtility.isNullOrEmpty(prov) || prov.equals("ExternalIpProvider")){
			prov = "http://ip.51240.com";
		}
		return prov;
	}
	
	public static String getExternalIp(){
		if(StringUtility.isNullOrEmpty(externalIp)){
			try{
				String extipprovider = getExternalIpProvider();
				externalIp = IPUtility.getExternalIp(extipprovider);
			}catch(Exception e){
				externalIp = "";
				e.printStackTrace();
			}
		}
		return externalIp;
	}
	
	public static String getAppServer(HttpServletRequest request){
		String approot = getAppRoot(request);
		if(approot.contains("127.0.0.1") || approot.toLowerCase().contains("localhost")){
			String extip = getExternalIp();
			if(!StringUtility.isNullOrEmpty(extip)){
				approot = approot.replace("127.0.0.1", extip).replace("localhost", extip).replace("LOCALHOST", extip);
			}
		}
		StringBuilder appserver = new StringBuilder(approot);
    	appserver.append(request.getContextPath());
    	return appserver.toString();
	}

	public static String getClientIp(HttpServletRequest request){
		String ip;
		try{
			ip = request.getHeader("x-real-ip");
			if(StringUtility.isNullOrEmpty(ip)){
				ip = request.getHeader("HTTP_X_REAL_IP");
			}
			if(StringUtility.isNullOrEmpty(ip)){
				ip = request.getHeader("HTTP_X_FORWARDED_FOR");
			}
			if(StringUtility.isNullOrEmpty(ip)){
				ip = request.getHeader("x-forwarded-for");
			}
			if(StringUtility.isNullOrEmpty(ip)){
				ip = request.getHeader("x-remote-IP");
			}
			if(StringUtility.isNullOrEmpty(ip)){
				ip = request.getHeader("x-originating-IP");
			}
			if(StringUtility.isNullOrEmpty(ip)){
				ip = request.getHeader("x-remote-ip");
			}
			if(StringUtility.isNullOrEmpty(ip)){
				ip = request.getHeader("x-remote-addr");
			}
			if(StringUtility.isNullOrEmpty(ip)){
				ip = request.getHeader("x-client-ip");
			}
			if(StringUtility.isNullOrEmpty(ip)){
				ip = request.getHeader("x-client-IP");
			}
			if(StringUtility.isNullOrEmpty(ip)){
				ip = request.getHeader("X-Real-ip");
			}
			if(StringUtility.isNullOrEmpty(ip)){
				ip = request.getHeader("LocalIp");
			}
			if(StringUtility.isNullOrEmpty(ip) || ip.toLowerCase().indexOf("unknown") >= 0){
				ip = request.getRemoteAddr();
			}else{
				ip = ip.split(",")[0];
			}
		}catch(Exception e){
			ip = request.getRemoteAddr();
		}
		
		return ip;
	}
	
	public static String getClientIp(WebRequest request){
		String ip;
		try{
			ip = request.getHeader("x-real-ip");
			if(StringUtility.isNullOrEmpty(ip)){
				ip = request.getHeader("HTTP_X_REAL_IP");
			}
			if(StringUtility.isNullOrEmpty(ip)){
				ip = request.getHeader("HTTP_X_FORWARDED_FOR");
			}
			if(StringUtility.isNullOrEmpty(ip)){
				ip = request.getHeader("x-forwarded-for");
			}
			if(StringUtility.isNullOrEmpty(ip)){
				ip = request.getHeader("x-remote-IP");
			}
			if(StringUtility.isNullOrEmpty(ip)){
				ip = request.getHeader("x-originating-IP");
			}
			if(StringUtility.isNullOrEmpty(ip)){
				ip = request.getHeader("x-remote-ip");
			}
			if(StringUtility.isNullOrEmpty(ip)){
				ip = request.getHeader("x-remote-addr");
			}
			if(StringUtility.isNullOrEmpty(ip)){
				ip = request.getHeader("x-client-ip");
			}
			if(StringUtility.isNullOrEmpty(ip)){
				ip = request.getHeader("x-client-IP");
			}
			if(StringUtility.isNullOrEmpty(ip)){
				ip = request.getHeader("X-Real-ip");
			}
			if(StringUtility.isNullOrEmpty(ip)){
				ip = request.getHeader("LocalIp");
			}
			if(StringUtility.isNullOrEmpty(ip) || ip.toLowerCase().indexOf("unknown") >= 0){
				ip = request.getRemoteUser();
				if(request instanceof ServletWebRequest){
					ServletWebRequest req = (ServletWebRequest) request;
					HttpServletRequest httpreq = req.getRequest();
					ip = httpreq.getRemoteAddr();
				}
			}else{
				ip = ip.split(",")[0];
			}
		}catch(Exception e){
			ip = request.getRemoteUser();
			if(request instanceof ServletWebRequest){
				ServletWebRequest req = (ServletWebRequest) request;
				HttpServletRequest httpreq = req.getRequest();
				ip = httpreq.getRemoteAddr();
			}
		}
		
		return ip;
	}
	
	public static String getClientIpByCdn(HttpServletRequest request){
		String ip;
		try{
			ip = request.getHeader("HTTP_X_FORWARDED_FOR");
			if(StringUtility.isNullOrEmpty(ip) || ip.toLowerCase().indexOf("unknown") >= 0){
				ip = request.getRemoteAddr();
			}else{
				ip = ip.split(",")[0];
			}
		}catch(Exception e){
			ip = request.getRemoteAddr();
		}
		
		return ip;
	}

}
