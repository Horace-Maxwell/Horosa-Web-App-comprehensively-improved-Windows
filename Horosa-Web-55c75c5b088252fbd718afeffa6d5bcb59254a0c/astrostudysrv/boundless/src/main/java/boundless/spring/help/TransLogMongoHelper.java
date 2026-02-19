package boundless.spring.help;

import java.util.Collection;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;

import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.spring.help.interceptor.KeyConstants;
import boundless.spring.help.interceptor.TransData;
import boundless.types.ICache;
import boundless.types.Tuple;
import boundless.types.Tuple3;
import boundless.types.cache.CacheFactory;
import boundless.types.cache.FilterCond;
import boundless.types.cache.FilterCond.CondOperator;
import boundless.types.cache.FilterOrCond;
import boundless.types.cache.SortCond;
import boundless.types.cache.SortCond.SortType;
import boundless.utility.CalculatePool;
import boundless.utility.ConsoleUtility;
import boundless.utility.ConvertUtility;
import boundless.utility.FormatUtility;
import boundless.utility.IPUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;
import boundless.web.common.IUser;
import boundless.web.help.AppServerPathHelper;

public class TransLogMongoHelper {
	private static ICache translogCache = CacheFactory.getCache("translogmongo");
	
	private static boolean NeedTransLog = PropertyPlaceholder.getProperty("needtranslog", false);
	private static boolean UseTransSet = PropertyPlaceholder.getProperty("uselogtranscodeset", false);
	private static Set<String> transSet = new HashSet<String>();
	private static Set<String> excludeTransSet = new HashSet<String>();
	
	private static List<Map> LogQryTransCodes = new LinkedList<Map>();
	private static String serverIp;
	private static int serverPort;
	
	static{
		if(UseTransSet){
			try{
				String json = FileUtility.getStringFromClassPath("conf/log/logtranscodes.json");
				transSet = JsonUtility.decodeSet(json, String.class);
			}catch(Exception e){
				QueueLog.error(AppLoggers.ErrorLogger, "data/logtranscodes.json has some error or miss");
				transSet = new HashSet<String>();
			}
		}
		try{
			String json = FileUtility.getStringFromClassPath("conf/log/excludelogtrans.json");
			excludeTransSet = JsonUtility.decodeSet(json, String.class);
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, "conf/log/excludelogtrans.json has some error or miss");
		}
		
		try {
			String json = FileUtility.getStringFromClassPath("conf/log/logqrytrcodes.json");
			LogQryTransCodes = JsonUtility.decodeList(json, Map.class);
		}catch(Exception e) {
			QueueLog.error(AppLoggers.ErrorLogger, "conf/log/logqrytrcodes.json has some error or miss");			
		}
	}

	public static ICache getTransLogCache(){
		return translogCache;
	}
	
	
	private static void logTransCode(String path, HttpServletRequest request, HttpServletResponse response){
		if(excludeTransSet.contains(path)){
			return;
		}
		if(UseTransSet){
			if(!transSet.contains(path)){
				return;
			}
		}
		
		if(path.equals("/")) {
			if(TransData.isNoRestful()) {
				path = TransData.getNoRestTransCode();
			}
		}
		
		Tuple3<Map<String, Object>, Map<String, Object>, Map<String, Object>> params = TransData.getRequestTuple();
		Map<String, Object> header = params.item1();
		Map<String, Object> reqparam = params.item2();
		Map<String, Object> multiparts = params.item3();
		
		ICache cache = getTransLogCache();
		
		Map<String, Object> map = new HashMap<String, Object>();
		
		IUser user = TransData.getCurrentUser();
		if(user != null){
			map.put(TransLogField.userseq.toString(), user.getSeq());
			map.put(TransLogField.userid.toString(), user.getLoginId());
			map.put(TransLogField.username.toString(), user.getName());
			map.put(TransLogField.customerid.toString(), user.getLoginCustomerId());
			map.put(TransLogField.customername.toString(), user.getLoginCustomerName());
			map.put(TransLogField.customerseq.toString(), user.getLoginCustomerSeq());			
		}else if(path.endsWith("/login") || path.endsWith("/userlogin")) {
			map.put(TransLogField.userid.toString(), (String) reqparam.get("LoginId"));
			map.put(TransLogField.customerid.toString(), (String) reqparam.get("CustomerId"));
		}
		
		map.put(TransLogField.tm.toString(), System.currentTimeMillis());
		map.put(TransLogField.transcode.toString(), path);
		map.put(TransLogField.transname.toString(), PropertyPlaceholder.getProperty(path, path));
		map.put(TransLogField.head.toString(), header);
		map.put(TransLogField.params.toString(), reqparam);
		map.put(TransLogField.multiparts.toString(), multiparts);
		map.put(TransLogField.clientip.toString(), AppServerPathHelper.getClientIp(request));
		map.put(TransLogField.remoteaddr.toString(), request.getRemoteAddr());
		
		String ch = ConvertUtility.getValueAsString(header.get("clientchannel"));
		if(StringUtility.isNullOrEmpty(ch)) {
			map.put(TransLogField.channel.toString(), ClientChannel.Unknwon);
		}else {
			map.put(TransLogField.channel.toString(), ClientChannel.fromCode(ch));			
		}
		String app = ConvertUtility.getValueAsString(header.get("clientapp"));
		ClientApp clientapp = ClientApp.fromCode(app);
		String appstr = clientapp.toString();
		if(clientapp == ClientApp.Unknwon) {
			appstr = app;
		}
		map.put(TransLogField.app.toString(), appstr);
		map.put(TransLogField.ver.toString(), header.get("clientver"));
		map.put(TransLogField.time.toString(), FormatUtility.formatDateTime(new Date(), "yyyy-MM-dd HH:mm:ss"));		
		map.put(TransLogField.appId.toString(), app);
		
		if(StringUtility.isNullOrEmpty(serverIp)){
			List<Tuple<String, Integer>> list = IPUtility.getServerIpPorts();
			if(!list.isEmpty()){
				StringBuilder srv = new StringBuilder();
				for(Tuple<String, Integer> addr : list) {
					srv.append(addr.item1()).append(':').append(addr.item2()).append("; ");
					serverPort = addr.item2();
				}
				serverIp = srv.toString();
			}
		}
		
		map.put(TransLogField.serverip.toString(), serverIp);
		map.put(TransLogField.serverport.toString(), serverPort);
		
		Exception ex = (Exception)request.getAttribute(KeyConstants.AttrExceptionObj);
		boolean exptOccured = ConvertUtility.getValueAsBool(request.getAttribute(KeyConstants.AttrExceptionOccured), false);
		if(exptOccured){
			map.put(TransLogField.errcode.toString(), request.getAttribute(KeyConstants.AttrExceptionCode));
			map.put(TransLogField.errmsg.toString(), request.getAttribute(KeyConstants.AttrExceptionMsg));			
		}else{
			int status = response.getStatus();
			if(HttpStatus.OK.value() != status) {
				HttpStatus httpstatus = HttpStatus.resolve(status);
				map.put(TransLogField.errcode.toString(), status);
				if(httpstatus == null) {
					map.put(TransLogField.errmsg.toString(), HttpStatus.INTERNAL_SERVER_ERROR.getReasonPhrase());
				}else {
					map.put(TransLogField.errmsg.toString(), httpstatus.getReasonPhrase());
				}					
			}else {
				map.put(TransLogField.errcode.toString(), 0);
				map.put(TransLogField.errmsg.toString(), null);					
			}
		}

		long delta = System.currentTimeMillis() - ConvertUtility.getValueAsLong(request.getAttribute(KeyConstants.AttrTransBeginTimeKey));
		map.put(TransLogField.transtm.toString(), delta);
		
		Map<String, Object> respheaders = new HashMap<String, Object>();
		Collection<String> names = response.getHeaderNames();
		for(String n: names){
			respheaders.put(n, response.getHeader(n));
		}
		map.put(TransLogField.respheaders.toString(), respheaders);
		
		Object res = TransData.getResponseData();
		map.put(TransLogField.result.toString(), res);
		
		CalculatePool.queueUserWorkItem(()->{ 
			if(ex != null){
				String stacktrace = ConsoleUtility.getStackTrace(ex);
				map.put(TransLogField.errstack.toString(), stacktrace);				
			}

			cache.add(map); 
		});
	}
	
	public static void logTransCode(HttpServletRequest request, HttpServletResponse response){
		if(!NeedTransLog){
			return;
		}
		
		String path = request.getRequestURI();
		String ctx = request.getServletContext().getContextPath();
		path = path.substring(ctx.length());

		logTransCode(path, request, response);
	}
	
	public static FilterCond filterTransCode(String[] transcodes){
		if(transcodes == null || transcodes.length == 0 || transcodes[0] == null){
			return null;
		}
		if(transcodes.length == 1){
			return new FilterCond(TransLogField.transcode.toString(), CondOperator.Like, transcodes[0]);
		}
		
		FilterCond cond1 = new FilterCond(TransLogField.transcode.toString(), CondOperator.Like, transcodes[0]);
		FilterCond cond2 = new FilterCond(TransLogField.transcode.toString(), CondOperator.Like, transcodes[1]);
		FilterOrCond orcond = new FilterOrCond(cond1, cond2);
		FilterCond transCond = orcond;
		for(int i=2; i<transcodes.length; i++){
			FilterCond tmp = new FilterCond(TransLogField.transcode.toString(), CondOperator.Like, transcodes[i]);
			orcond = new FilterOrCond(orcond, tmp);
			transCond = orcond;
		}
		
		return transCond;
	}
	
	public static FilterCond filterUsers(Object[] users){
		if(users == null || users.length == 0 || users[0] == null){
			return null;
		}
		if(users.length == 1){
			Object obj = users[0];
			if(obj instanceof String) {
				return new FilterCond(TransLogField.userid.toString(), CondOperator.Eq, users[0]);				
			}else {
				return new FilterCond(TransLogField.userseq.toString(), CondOperator.Eq, users[0]);				
			}
		}

		Object obj0 = users[0];
		Object obj1 = users[1];
		FilterCond cond1;
		FilterCond cond2;
		if(obj0 instanceof String) {
			cond1 = new FilterCond(TransLogField.userid.toString(), CondOperator.Eq, obj0);
		}else {
			cond1 = new FilterCond(TransLogField.userseq.toString(), CondOperator.Eq, obj0);
		}
		if(obj1 instanceof String) {
			cond2 = new FilterCond(TransLogField.userid.toString(), CondOperator.Eq, obj1);
		}else {
			cond2 = new FilterCond(TransLogField.userseq.toString(), CondOperator.Eq, obj1);
		}
		FilterOrCond orcond = new FilterOrCond(cond1, cond2);
		FilterCond cusCond = orcond;
		for(int i=2; i<users.length; i++){
			Object obj = users[i];
			FilterCond tmpcus = new FilterCond(TransLogField.userseq.toString(), CondOperator.Eq, users[i]);
			if(obj instanceof String) {
				tmpcus = new FilterCond(TransLogField.userid.toString(), CondOperator.Eq, obj);
			}else {
				tmpcus = new FilterCond(TransLogField.userseq.toString(), CondOperator.Eq, obj);
			}
			orcond = new FilterOrCond(orcond, tmpcus);
			cusCond = orcond;
		}
		
		return cusCond;
	}
	
	
	public static FilterCond filterCustomer(Object[] customers){
		if(customers == null || customers.length == 0 || customers[0] == null){
			return null;
		}
		if(customers.length == 1){
			Object obj = customers[0];
			if(ConvertUtility.getValueAsInt(obj, -1) == 0 && obj.toString().length() == 1) {
				FilterCond nullcond = new FilterCond(TransLogField.customerseq.toString(), CondOperator.Eq, null);	
				FilterCond zerocond = new FilterCond(TransLogField.customerseq.toString(), CondOperator.Eq, 0);	
				return new FilterOrCond(nullcond, zerocond);
			}else {
				if(obj instanceof String) {
					return new FilterCond(TransLogField.customerid.toString(), CondOperator.Eq, customers[0]);									
				}else {
					return new FilterCond(TransLogField.customerseq.toString(), CondOperator.Eq, customers[0]);									
				}
			}
		}

		FilterCond cond1;
		FilterCond cond2;
		Object obj0 = customers[0];
		Object obj1 = customers[1];
		if(obj0 instanceof String) {
			cond1 = new FilterCond(TransLogField.customerid.toString(), CondOperator.Eq, customers[0]);
		}else {
			cond1 = new FilterCond(TransLogField.customerseq.toString(), CondOperator.Eq, customers[0]);
		}
		if(obj1 instanceof String) {
			cond2 = new FilterCond(TransLogField.customerid.toString(), CondOperator.Eq, customers[1]);
		}else {
			cond2 = new FilterCond(TransLogField.customerseq.toString(), CondOperator.Eq, customers[1]);
		}
		FilterOrCond orcond = new FilterOrCond(cond1, cond2);
		FilterCond cusCond = orcond;
		for(int i=2; i<customers.length; i++){
			Object obj = customers[i];
			FilterCond tmpcus;
			if(obj instanceof String) {
				tmpcus = new FilterCond(TransLogField.customerid.toString(), CondOperator.Eq, obj);
			}else {
				tmpcus = new FilterCond(TransLogField.customerseq.toString(), CondOperator.Eq, obj);
			}
			if(ConvertUtility.getValueAsInt(obj, -1) == 0 && obj.toString().length() == 1) {
				FilterCond nullcond = new FilterCond(TransLogField.customerseq.toString(), CondOperator.Eq, null);	
				tmpcus = new FilterOrCond(nullcond, tmpcus);
			}
			orcond = new FilterOrCond(orcond, tmpcus);
			cusCond = orcond;
		}
		
		return cusCond;
	}
	
	public static List<Map<String, Object>> findCustomerTransLogs(int limit, long totm, String[] transcodes, Object... customers){
		ICache cache = getTransLogCache();
		SortCond sort = new SortCond(TransLogField.tm.toString(), SortType.Desc);
		FilterCond tmCond = new FilterCond(TransLogField.tm.toString(), CondOperator.Lt, totm);
		FilterCond transCond = filterTransCode(transcodes);
		FilterCond cusCond = filterCustomer(customers);
		if(transCond == null){
			if(cusCond == null){
				return cache.findValues(limit, sort, tmCond);
			}else{
				cache.findValues(limit, sort, tmCond, cusCond);
			}
		}else{
			if(cusCond == null){
				return cache.findValues(limit, sort, tmCond, transCond);
			}
		}

		return cache.findValues(limit, sort, tmCond, transCond, cusCond);
	}
	
	public static long countCustomerTransLogs(long totm, String[] transcodes, Object... customers){
		ICache cache = getTransLogCache();
		FilterCond tmCond = new FilterCond(TransLogField.tm.toString(), CondOperator.Lt, totm);
		FilterCond transCond = filterTransCode(transcodes);
		FilterCond cusCond = filterCustomer(customers);
		if(transCond == null){
			if(cusCond == null){
				return cache.countValues(tmCond);
			}else{
				cache.countValues(tmCond, cusCond);
			}
		}else{
			if(cusCond == null){
				return cache.countValues(tmCond, transCond);
			}
		}
		
		return cache.countValues(tmCond, transCond, cusCond);
	}
	

	public static List<Map<String, Object>> findCustomerTransLogs(int limit, long stTm, long totm, String[] transcodes, Object... customers){
		ICache cache = getTransLogCache();
		SortCond sort = new SortCond(TransLogField.tm.toString(), SortType.Desc);
		FilterCond sttmCond = new FilterCond(TransLogField.tm.toString(), CondOperator.Gte, stTm);
		FilterCond tmCond = new FilterCond(TransLogField.tm.toString(), CondOperator.Lt, totm);
		FilterCond transCond = filterTransCode(transcodes);
		FilterCond cusCond = filterCustomer(customers);
		if(transCond == null){
			if(cusCond == null){
				return cache.findValues(limit, sort, sttmCond, tmCond);
			}else{
				cache.findValues(limit, sort, sttmCond, tmCond, cusCond);
			}
		}else{
			if(cusCond == null){
				return cache.findValues(limit, sort, sttmCond, tmCond, transCond);
			}
		}

		return cache.findValues(limit, sort, sttmCond, tmCond, transCond, cusCond);
	}
	
	public static long countCustomerTransLogs(long stTm, long totm, String[] transcodes, Object... customers){
		ICache cache = getTransLogCache();
		FilterCond sttmCond = new FilterCond(TransLogField.tm.toString(), CondOperator.Gte, stTm);
		FilterCond tmCond = new FilterCond(TransLogField.tm.toString(), CondOperator.Lt, totm);
		FilterCond transCond = filterTransCode(transcodes);
		FilterCond cusCond = filterCustomer(customers);
		if(transCond == null){
			if(cusCond == null){
				return cache.countValues(sttmCond, tmCond);
			}else{
				cache.countValues(sttmCond, tmCond, cusCond);
			}
		}else{
			if(cusCond == null){
				return cache.countValues(sttmCond, tmCond, transCond);
			}
		}
		
		return cache.countValues(sttmCond, tmCond, transCond, cusCond);
	}
	
	
	public static List<Map<String, Object>> findUserTransLogs(int limit, long totm, String[] transcodes, Object... users){
		ICache cache = getTransLogCache();
		SortCond sort = new SortCond(TransLogField.tm.toString(), SortType.Desc);
		FilterCond tmCond = new FilterCond(TransLogField.tm.toString(), CondOperator.Lt, totm);
		FilterCond transCond = filterTransCode(transcodes);
		FilterCond userCond = filterUsers(users);
		if(transCond == null){
			if(userCond == null){
				return cache.findValues(limit, sort, tmCond);
			}else{
				return cache.findValues(limit, sort, tmCond, userCond);
			}
		}else{
			if(userCond == null){
				return cache.findValues(limit, sort, tmCond, transCond);
			}
		}

		return cache.findValues(limit, sort, tmCond, transCond, userCond);
	}
	
	public static long countUserTransLogs(long totm, String[] transcodes, Object... users){
		ICache cache = getTransLogCache();
		FilterCond tmCond = new FilterCond(TransLogField.tm.toString(), CondOperator.Lt, totm);
		FilterCond transCond = filterTransCode(transcodes);
		FilterCond userCond = filterUsers(users);
		if(transCond == null){
			if(userCond == null){
				return cache.countValues(tmCond);
			}else{
				cache.countValues(tmCond, userCond);
			}
		}else{
			if(userCond == null){
				return cache.countValues(tmCond, transCond);
			}
		}
		
		return cache.countValues(tmCond, transCond, userCond);
	}
	
	public static List<Map<String, Object>> findUserTransLogs(int limit, long stTm, long totm, String[] transcodes, Object... users){
		ICache cache = getTransLogCache();
		SortCond sort = new SortCond(TransLogField.tm.toString(), SortType.Desc);
		FilterCond sttmCond = new FilterCond(TransLogField.tm.toString(), CondOperator.Gte, stTm);
		FilterCond tmCond = new FilterCond(TransLogField.tm.toString(), CondOperator.Lt, totm);
		FilterCond transCond = filterTransCode(transcodes);
		FilterCond userCond = filterUsers(users);
		if(transCond == null){
			if(userCond == null){
				return cache.findValues(limit, sort, sttmCond, tmCond);
			}else{
				return cache.findValues(limit, sort, sttmCond, tmCond, userCond);
			}
		}else{
			if(userCond == null){
				return cache.findValues(limit, sort, sttmCond, tmCond, transCond);
			}
		}

		return cache.findValues(limit, sort, sttmCond, tmCond, transCond, userCond);
	}
	
	public static long countUserTransLogs(long stTm, long totm, String[] transcodes, Object... users){
		ICache cache = getTransLogCache();
		FilterCond sttmCond = new FilterCond(TransLogField.tm.toString(), CondOperator.Gte, stTm);
		FilterCond tmCond = new FilterCond(TransLogField.tm.toString(), CondOperator.Lt, totm);
		FilterCond transCond = filterTransCode(transcodes);
		FilterCond userCond = filterUsers(users);
		if(transCond == null){
			if(userCond == null){
				return cache.countValues(sttmCond, tmCond);
			}else{
				cache.countValues(sttmCond, tmCond, userCond);
			}
		}else{
			if(userCond == null){
				return cache.countValues(sttmCond, tmCond, transCond);
			}
		}
		
		return cache.countValues(sttmCond, tmCond, transCond, userCond);
	}
	
	public static List<Map<String, Object>> aggregateUserTransLogs(List<String> groupKeys, List<String> aggreKeys, long stTm, long totm, String[] transcodes, Object... users){
		ICache cache = getTransLogCache();
		FilterCond sttmCond = new FilterCond(TransLogField.tm.toString(), CondOperator.Gte, stTm);
		FilterCond tmCond = new FilterCond(TransLogField.tm.toString(), CondOperator.Lt, totm);
		FilterCond transCond = filterTransCode(transcodes);
		FilterCond userCond = filterUsers(users);
		if(transCond == null){
			if(userCond == null){
				return cache.aggregate(groupKeys, aggreKeys, sttmCond, tmCond);
			}else{
				cache.aggregate(groupKeys, aggreKeys, sttmCond, tmCond, userCond);
			}
		}else{
			if(userCond == null){
				return cache.aggregate(groupKeys, aggreKeys, sttmCond, tmCond, transCond);
			}
		}
		
		return cache.aggregate(groupKeys, aggreKeys, sttmCond, tmCond, transCond, userCond);		
	}
		
	
	public static List<Map> getLogQryTransCodes(){
		return LogQryTransCodes;
	}
		
}
