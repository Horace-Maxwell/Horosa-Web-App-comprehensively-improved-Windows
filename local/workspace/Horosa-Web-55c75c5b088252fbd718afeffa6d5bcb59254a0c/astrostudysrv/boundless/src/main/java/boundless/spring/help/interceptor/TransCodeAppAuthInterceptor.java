package boundless.spring.help.interceptor;

import java.io.File;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.springframework.web.servlet.HandlerInterceptor;

import boundless.exception.ErrorCodeException;
import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class TransCodeAppAuthInterceptor implements HandlerInterceptor {
	private static Set<String> superApps = new HashSet<String>();
	private static Set<String> commonTrans = new HashSet<String>();
	private static Map<String, Set<String>> transMap = new HashMap<String, Set<String>>();
	private static Map<String, Set<String>> appTransMap = new HashMap<String, Set<String>>();
	private static boolean needCheck = true;
	
	static {
		try {
			String json = FileUtility.getStringFromClassPath("data/transcodeappauth.json");
			Map<String, Object> map = JsonUtility.toDictionary(json);
			needCheck = ConvertUtility.getValueAsBool(map.get("needCheck"), true);
			
			List<String> apps = (List<String>) map.get("superApp");
			for(String app : apps) {
				superApps.add(app);
				superApps.add(app.toLowerCase());
			}

			List<String> common = (List<String>) map.get("commonTransCodes");
			commonTrans.addAll(common);

			Map<String, List<String>> trans = (Map<String, List<String>>) map.get("transCodes");
			for(Map.Entry<String, List<String>> entry : trans.entrySet()) {
				String transcode = entry.getKey();
				Set<String> set = transMap.get(transcode);
				if(set == null) {
					set = new HashSet<String>();
					transMap.put(transcode, set);
				}
				for(String app : entry.getValue()) {
					set.add(app);
					set.add(app.toLowerCase());
				}
			}
			
		}catch(Exception e) {
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
	}
	
	private static void readAppTrans() {
		FileUtility.iteratePackage("data/transcodeauth", (file)->{
			if(file instanceof File) {
				addAppTrans((File)file);				
			}else {
				addAppTrans((String)file);
			}
			return false;
		});
	}
	
	private static void addAppTrans(File file) {
		String fname = file.getAbsolutePath();
		if(!fname.endsWith(".json")){
			return;
		}
		char[] seprators = new char[]{'/', '\\'};
		String[] parts = StringUtility.splitString(fname, seprators);
		try{
			String app = null;
			if(parts.length > 1) {
				app = parts[parts.length-2];
			}
			String json = FileUtility.getStringFromFile(fname);
			addAppTrans(app, json);
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e);
			throw new RuntimeException(e);
		}
		
	}
	
	private static void addAppTrans(String classpath) {
		if(!classpath.endsWith(".json")) {
			return;
		}
		String path = classpath;
		if(path.startsWith("/")) {
			path = path.substring(1);
		}
		String[] parts = StringUtility.splitString(path, '/');
		String app = null;
		if(parts.length > 1) {
			app = parts[parts.length-2];
		}
		String json = FileUtility.getStringFromClassPath(path);
		addAppTrans(app, json);
	}
	
	private static void addAppTrans(String app, String json) {
		Map<String, Object> map = JsonUtility.toDictionary(json);
		List<String> transcodes = (List<String>) map.get("transcodes");
		Set<String> codes = new HashSet<String>();
		for(String code : transcodes) {
			codes.add(code);
		}
		appTransMap.put(app, codes);
		appTransMap.put(app.toLowerCase(), codes);
	}
	

	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
		if(!needCheck) {
			return true;
		}
		
		String app = TransData.getClientApp();
		if(superApps.contains(app) || superApps.contains(app.toLowerCase())) {
			return true;
		}
		
		String transcode = TransData.getTransCode();
		if(commonTrans.contains(transcode) || transcode.contains("/common/")) {
			return true;
		}
		
		Set<String> set = transMap.get(transcode);
		if(set != null && (set.contains(app) || set.contains(app.toLowerCase()))) {
			return true;
		}

		Set<String> transSet = appTransMap.get(app.toLowerCase());
		if(transSet != null && transSet.contains(transcode)) {
			return true;
		}
		
				
		throw new ErrorCodeException(1000, "access_deny");
	}

}
