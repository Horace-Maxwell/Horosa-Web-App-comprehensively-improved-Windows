package boundless.web.common;

import java.util.HashMap;
import java.util.Map;

import javax.servlet.ServletContext;
import javax.servlet.http.HttpSession;
import javax.servlet.http.HttpSessionBindingEvent;
import javax.servlet.http.HttpSessionBindingListener;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.spring.help.PropertyPlaceholder;
import boundless.utility.ConvertUtility;

public class OnlineUserBindingListener implements HttpSessionBindingListener {
	private static final String MultiClientExclusiveLoginKey = "web.request.multiclient.exclusivelogin";
	private static final String ExclusiveLoginKey = "web.request.exclusivelogin";
	
	public static final boolean ExclusiveLogin;
	public static final boolean MultiClientExclusiveLogin;
	
	private static final String ONLINEUSERS_KEY = "__ONLINE_USERS__";
	
	static{
		MultiClientExclusiveLogin = ConvertUtility.getValueAsBool(PropertyPlaceholder.getProperty(MultiClientExclusiveLoginKey), false);
		ExclusiveLogin = ConvertUtility.getValueAsBool(PropertyPlaceholder.getProperty(ExclusiveLoginKey), false);
	}
	
	private static Map<String, HttpSession> getOnlineUserMap(ServletContext app){
		Map<String, HttpSession> map = (Map<String, HttpSession>) app.getAttribute(ONLINEUSERS_KEY);
		if(map == null){
			map = new HashMap<String, HttpSession>();
			app.setAttribute(ONLINEUSERS_KEY, map);
		}
		return map;
	}
	
	public static int countOnlineUsers(ServletContext app){
		Map<String, HttpSession> map = getOnlineUserMap(app);
		return map.size();
	}
	
	private static String getKey(String key, String clientType){
		if(MultiClientExclusiveLogin){
			return key;
		}
		
		String res = clientType;
		if(res == null){
			res = "";
		}
		return res + "_" + key;
	}
	
	public static HttpSession getCachedSession(ServletContext app, String key, String clientType){
		Map<String, HttpSession> map = getOnlineUserMap(app);
		String sesskey = getKey(key, clientType);
		return map.get(sesskey);
	}
	
	private String userId;
	private String clientType;
	
	public OnlineUserBindingListener(String userid, String clientType){
		this.userId = userid;
		this.clientType = clientType;
	}

	@Override
	public void valueBound(HttpSessionBindingEvent event) {
		HttpSession session = event.getSession();
		String key = this.userId;
		if(!ExclusiveLogin){
			key = session.getId();
		}
		String sesskey = getKey(key, this.clientType);
		
		ServletContext app = session.getServletContext();
		Map<String, HttpSession> map = getOnlineUserMap(app);
		HttpSession oldsess = map.get(sesskey);
		
		if(oldsess != null && oldsess != session){
			if(ExclusiveLogin){
				QueueLog.info(AppLoggers.DebugLogger, "sesskey:{}, oldsession existed, will invalidate", sesskey);
				oldsess.invalidate();
			}
		}
		map.put(sesskey, session);
		QueueLog.info(AppLoggers.DebugLogger, "sesskey:{}, after bound, online count:{}", sesskey, map.size());
	}

	@Override
	public void valueUnbound(HttpSessionBindingEvent event) {
		HttpSession session = event.getSession();
		String key = this.userId;
		if(!ExclusiveLogin){
			key = session.getId();
		}
		String sesskey = getKey(key, this.clientType);

		Map<String, HttpSession> map = getOnlineUserMap(session.getServletContext());
		map.remove(sesskey);
		QueueLog.info(AppLoggers.DebugLogger, "oldsession removde, sesskey:{}, after unbound, online count:{}", sesskey, map.size());
	}

}
