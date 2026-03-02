package boundless.spring.help.interceptor;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;

import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.springframework.core.NamedThreadLocal;
import org.springframework.web.multipart.MultipartFile;

import boundless.io.FileUtility;
import boundless.spring.help.PropertyPlaceholder;
import boundless.spring.help.springcomp.ApplicationContextProvider;
import boundless.types.FileType;
import boundless.types.Tuple3;
import boundless.utility.ConvertUtility;
import boundless.utility.FormatUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;
import boundless.web.common.IUser;
import boundless.web.help.AppServerPathHelper;


public class TransData {
	private static NamedThreadLocal<Map<String, Object>>  requestHeadThreadLocal =   
			new NamedThreadLocal<Map<String, Object>>("BoundlessRequestHead");
	
	private static NamedThreadLocal<Map<String, Object>>  requestMapThreadLocal =   
			new NamedThreadLocal<Map<String, Object>>("BoundlessRequestMap"); 

	private static NamedThreadLocal<Map<String, Object>>  orgReqMapThreadLocal =   
			new NamedThreadLocal<Map<String, Object>>("BoundlessOrgRequestMap"); 

	private static NamedThreadLocal<Map<String, Object>>  responseHeadThreadLocal =   
			new NamedThreadLocal<Map<String, Object>>("BoundlessResponseHead");
	
	private static NamedThreadLocal<Map<String, Object>>  responseMapThreadLocal =   
			new NamedThreadLocal<Map<String, Object>>("BoundlessResponseMap"); 
	
	
	private static boolean prettyResponse = PropertyPlaceholder.getPropertyAsBool("response.prettyformat", true);
	private static String[] PageIndexKey = StringUtility.splitString(PropertyPlaceholder.getProperty("page_index_key", "pageindex,pageIndex,PageIndex"), ',');
	private static String[] PageSizeKey = StringUtility.splitString(PropertyPlaceholder.getProperty("page_size_key", "pagesize,pageSize,PageSize"), ',');
	private static int DefaultPageSize = ConvertUtility.getValueAsInt(PropertyPlaceholder.getProperty("default_page_size"), 5000);
	
	private static final String RawDataKey = "__rawdata__";
	private static final String HtmlFragmentKey = "__htmlfragment__";
	private static final String SseKey = "__sse__";
	
	static final String ApiDocKey = "__apidoc__";
	
	private static final String RemoveParamStr = PropertyPlaceholder.getProperty("remvedparams", "Password,OldPassword,Pwd,Passwd,UserPassword,LoginPassword,_rsaparam_");
	private static final String[] RemovedParams = StringUtility.splitString(RemoveParamStr, ',');
	
	static{
		DefaultPageSize = DefaultPageSize <= 0 ? 5000 : DefaultPageSize;
	}
	
	public static class MultipartData{
		private byte[] data;
		private String name;
		private String fileName;
		
		public MultipartData(InputStream ins, String name, String fileName){
			this.data = FileUtility.getBytesFromStream(ins);
			this.name = name;
			this.fileName = fileName;
		}
		
		public byte[] getBytes(){
			return data;
		}
		
		public String getName(){
			return name;
		}
		
		public String getOriginalFilename(){
			return fileName;
		}
	}
	
	public static class MultipartObject{
		public String fieldName;
		MultipartFile[] files = null;
		MultipartData data = null;
		
		public String getOriginalFilename(){
			if(files != null){
				return files[0].getOriginalFilename();
			}else{
				return data.getOriginalFilename();
			}
		}
		
		public long getSize(){
			if(files != null){
				return files[0].getSize();
			}else{
				return data.getBytes().length;
			}
		}
		
		public byte[] getBytes(){
			if(files != null && files.length > 0){
				try {
					return files[0].getBytes();
				} catch (Exception e) {
					throw new RuntimeException(e);
				}
			}else{
				return data.getBytes();
			}
		}

		public InputStream getInputStream(){
			if(files != null && files.length > 0){
				try {
					return files[0].getInputStream();
				} catch (Exception e) {
					throw new RuntimeException(e);
				}
			}else{
				ByteArrayInputStream bis = new ByteArrayInputStream(data.getBytes());
				return bis;
			}
		}
	}
	
	public static class ResponseRawData{
		public byte[] data;
		public FileType contentType;
		public String filename;
		
		public ResponseRawData(byte[] data, FileType contentType, String filename) {
			this.data = data;
			this.contentType = contentType;
			this.filename = String.format("%s%s", filename, contentType.getFileExt()) ;
		}
	}
	
	
	static Map<String, Object> getRequestHeader(){
		Map<String, Object> header = requestHeadThreadLocal.get();
		if(header == null){
			header = new HashMap<String, Object>();
			requestHeadThreadLocal.set(header);
		}
		return header;
	}
	
	private static Map<String, Object> getRequestMap(){
		Map<String, Object> map = requestMapThreadLocal.get();
		if(map == null){
			map = new HashMap<String, Object>();
			requestMapThreadLocal.set(map);
		}
		return map;
	}
	
	private static Map<String, Object> getOrgReqMap(){
		Map<String, Object> map = orgReqMapThreadLocal.get();
		if(map == null){
			map = new HashMap<String, Object>();
			orgReqMapThreadLocal.set(map);
		}
		return map;
	}
	
	private static Map<String, Object> getResponseHeader(){
		Map<String, Object> header = responseHeadThreadLocal.get();
		if(header == null){
			header = new HashMap<String, Object>();
			responseHeadThreadLocal.set(header);
		}
		return header;
	}
	
	private static Map<String, Object> getResponseMap(){
		Map<String, Object> map = responseMapThreadLocal.get();
		if(map == null){
			map = new HashMap<String, Object>();
			responseMapThreadLocal.set(map);
		}
		return map;
	}
	
	public static void setMultiparts(List<MultipartObject> parts){
		MultipartObject[] ary = new MultipartObject[parts.size()];
		parts.toArray(ary);
		Map<String, Object> map = getRequestMap();
		map.put(KeyConstants.MultipartObject, ary);
	}
	
	public static MultipartObject[] getMultiparts(){
		Map<String, Object> map = getRequestMap();
		Object obj = map.get(KeyConstants.MultipartObject);
		return obj == null ? new MultipartObject[0] : (MultipartObject[])obj;
	}
	
	private static void setDefaultParams(Map<String, Object> params){

	}
	
	public static void setRequestData(Map<String, Object> head, Map<String, Object> params){
		Map<String, Object> reqhead = getRequestHeader();
		for(Map.Entry<String, Object> entry : head.entrySet()){
			String key = entry.getKey();
			Object val = entry.getValue();
			reqhead.put(key, val);
			reqhead.put(key.toLowerCase(), val);
		}
		requestHeadThreadLocal.set(reqhead);
		
		Map<String, Object> reqparams = new HashMap<String, Object>();
		for(Entry<String, Object> entry : params.entrySet()){
			String key = entry.getKey();
			Object val = entry.getValue();
			reqparams.put(key, val);
			reqparams.put(key.toLowerCase(), val);
		}
		setDefaultParams(reqparams);
		requestMapThreadLocal.set(reqparams);
		
		Map<String, Object> orgreq = getOrgReqMap();
		orgreq.putAll(params);
		
		setPaginationParams();
	}
	
	public static void replaceRequestData(String key, Object value){
		Map<String, Object> req = getRequestMap();
		req.put(key, value);
		req.put(key.toLowerCase(), value);
	}
	
	private static void setPaginationParams(){
		int pageidx = ConvertUtility.getValueAsInt(get(KeyConstants.PageIndex));
		int pagesize = ConvertUtility.getValueAsInt(get(KeyConstants.PageSize));
		boolean found = false;
		if(pageidx < 1){
			for(String key : PageIndexKey){
				pageidx = ConvertUtility.getValueAsInt(get(key));
				if(pageidx >= 1){
					found = true;
					break;
				}
			}
			if(pageidx < 1){
				pageidx = 1;
			}
		}else{
			found = true;
		}
		if(!found){
			return;
		}
		
		if(pagesize <= 0 || pagesize > 5000){
			for(String key : PageSizeKey){
				pagesize = ConvertUtility.getValueAsInt(get(key));
				if(pageidx > 0){
					break;
				}
			}
			if(pagesize <= 0 || pagesize > DefaultPageSize * 2){
				pagesize = DefaultPageSize;
			}
		}
		
		Map<String, Object> reqmap = getRequestMap();
		reqmap.put(KeyConstants.PageIndex, pageidx);
		reqmap.put(KeyConstants.RowIndex, (pageidx-1)*pagesize);
		reqmap.put(KeyConstants.PageSize, pagesize);
	}
	
	static void pureClearTransData() {
		Map<String, Object> reqheader = requestHeadThreadLocal.get();
		Map<String, Object> req = requestMapThreadLocal.get();
		Map<String, Object> repheader = responseHeadThreadLocal.get();
		Map<String, Object> rep = responseMapThreadLocal.get();
		Map<String, Object> orgreq = orgReqMapThreadLocal.get();

		if(reqheader != null)
			reqheader.clear();
		
		if(req != null)
			req.clear();
		
		if(repheader != null)
			repheader.clear();
		
		if(rep != null)
			rep.clear();
		
		if(orgreq != null)
			orgreq.clear();		
	}
	
	static void clearTransData(){
		String trans = getTransCode();
		if(!StringUtility.isNullOrEmpty(trans)) {
			HttpServletRequest request = getRequestObject();
			HttpServletResponse response = getResponseObject();
			TransLogHelper.logTrans(request, response);
		}
		
		pureClearTransData();
	}
	
	public static boolean hasPagination(){
		int pageidx = ConvertUtility.getValueAsInt(get(KeyConstants.PageIndex));
		if(pageidx < 1){
			for(String key : PageIndexKey){
				pageidx = ConvertUtility.getValueAsInt(get(key));
				if(pageidx >= 1){
					return true;
				}
			}
		}else{
			return true;
		}

		return false;
	}
	
	public static Map<String, Object> getPaginationParams(){
		return getPaginationParams(1, 20);
	}
	
	public static void addIsAdminParam(Map<String, Object> map){
		IUser user = getCurrentUser();
		if(user != null){
			map.put(KeyConstants.IsAdmin, user.isAdmin() + "");
		}
	}
	
	public static void addIsSelfAdminParam(Map<String, Object> map){
		IUser user = getCurrentUser();
		if(user != null){
			boolean flag = user.isAdmin() & user.isSelf();
			map.put(KeyConstants.IsSelfAdmin, flag + "");
		}
	}
	
	public static Map<String, Object> getPaginationParams(int defaultIdx, int defaultSize){
		Map<String, Object> map = new HashMap<String, Object>();
		if(!hasPagination()){
			map.put(KeyConstants.RowIndex, (defaultIdx-1)*defaultSize);
			map.put(KeyConstants.PageSize, defaultSize);
			return map;
		}
		
		int rowidx = ConvertUtility.getValueAsInt(getRequest(KeyConstants.RowIndex));
		int psz = ConvertUtility.getValueAsInt(getRequest(KeyConstants.PageSize));
		map.put(KeyConstants.RowIndex, rowidx);
		map.put(KeyConstants.PageSize, psz);
		return map;
	}
	
	public static int getPageIndex(){
		Object obj = getRequest(KeyConstants.PageIndex);
		if(obj == null){
			return 1;
		}
		return ConvertUtility.getValueAsInt(obj);
	}
	
	public static int getPageSize(){
		Object obj = getRequest(KeyConstants.PageSize);
		if(obj == null){
			return DefaultPageSize;
		}
		return ConvertUtility.getValueAsInt(obj);
	}
	
	public static void setPageSize(int sz){
		Map<String, Object> reqmap = getRequestMap();
		reqmap.put(KeyConstants.PageSize, sz);
	}
	
	public static void setPagination(int pageIdx, int pageSize){
		int idx = pageIdx;
		if(idx < 1){
			idx = 1;
		}
		Map<String, Object> reqmap = getRequestMap();
		reqmap.put(KeyConstants.PageIndex, idx);
		reqmap.put(KeyConstants.PageSize, pageSize);
		reqmap.put(KeyConstants.RowIndex, (idx-1) * pageSize);
	}
	
	public static int isLastPage(long total){
		return total > TransData.getPageSize() * TransData.getPageIndex() ? 0 : 1;
	}

	public static String getResponseJson(){
		Object obj = getResponseData();
		if(StringUtility.isNullOrEmpty(obj)){
			return "";
		}
		
		if(prettyResponse){
			String json = JsonUtility.encodePretty(obj);
			return json.replace("\n", "\r\n");
		}else{
			return JsonUtility.encode(obj);
		}
	}
	
	public static Object getResponseData(){
		Map<String, Object> map = responseMapThreadLocal.get();
		if(map == null){
			return "";
		}
		Object obj = map.get(KeyConstants.ResponseOnlyObj);
		if(obj != null) {
			return obj;
		}
		
		Object onlylistobj = map.get(KeyConstants.ResponseOnlyList);
		if(onlylistobj != null){
			List<Object> onlylist = (List<Object>) onlylistobj;
			List<Object> list = new ArrayList<Object>(onlylist.size());
			list.addAll(onlylist);
			return list;
		}
		
		Map<String, Object> resmap = new HashMap<String, Object>();
		resmap.putAll(map);
		return resmap;
	}
	
	public static void setSimpleResponse(Object obj) {
		set(KeyConstants.ResponseOnlyObj, obj);
	}
	
	public static Object getRequestHeader(String name){
		Map<String, Object> map = getRequestHeader();
		Object obj = map.get(name);
		if(obj == null){
			obj = map.get(name.toLowerCase());
		}
		return obj;
	}
	
	public static String getRequestJson(){
		Map<String, Object> map = getOrgReqMap();
		return JsonUtility.encode(map);
	}
	
	public static String getRequestJsonWithHead(){
		Tuple3<Map<String, Object>, Map<String, Object>, Map<String, Object>> tuple = getRequestTuple();

		Map<String, Object> res = new HashMap<String, Object>();
		Map<String, Object> head = tuple.item1();
		Map<String, Object> body = tuple.item2();
		head.remove(KeyConstants.RsaParam);
		res.put("head", head);
		res.put("body", body);
		res.put("multiparts", tuple.item3());
		
		return JsonUtility.encodePretty(res);
	}
	
	public static String getToken() {
		HttpServletRequest request = (HttpServletRequest)getRequestHeader(KeyConstants.RequestObject);
		String token = (String) getRequestHeader(KeyConstants.Token);
		if(StringUtility.isNullOrEmpty(token)){
			Cookie[] cookies = request.getCookies();
			if(cookies != null){
				for(Cookie cookie : cookies){
					String cname = cookie.getName();
					if(cname.equals(KeyConstants.Token)){
						token = cookie.getValue();
						break;
					}
				}
			}
			if(token == null){
				token = request.getParameter(KeyConstants.Token);
			}
		}
		return token;
	}
	
	
	public static Tuple3<Map<String, Object>, Map<String, Object>, Map<String, Object>> getRequestTuple(){
		MultipartObject[] multiparts = getMultiparts();
		Map<String, Object> map = getAllRequestParams();
		Map<String, Object> head = getAllHeaders();
		head.remove(KeyConstants.RequestObject);
		head.remove(KeyConstants.ResponseObject);
		head.remove(KeyConstants.CurrentUser);
		for(String p : RemovedParams) {
			head.remove(p);
			head.remove(p.toUpperCase());
			head.remove(p.toLowerCase());			
		}
		
		IUser user = TransData.getCurrentUser();
		if(user != null){
			head.put("user", user.toMap());
		}
		map.remove(KeyConstants.MultipartObject);
		for(String p : RemovedParams) {
			map.remove(p);
			map.remove(p.toUpperCase());
			map.remove(p.toLowerCase());			
		}
		
		Map<String, Object> mulmap = new HashMap<String, Object>();
		if(multiparts.length > 0){
			for(MultipartObject obj : multiparts){
				try{
					mulmap.put(obj.fieldName, obj.files[0].getSize());
				}catch(Exception e){
				}
			}
		}
		
		return new Tuple3<Map<String, Object>, Map<String, Object>, Map<String, Object>>(head, map, mulmap);
	}
	
	public static Object get(String name){
		Object res = null;
		Map<String, Object> map = getResponseMap();
		res = map.get(name);

		if(res == null){
			map = getRequestMap();
			res = map.get(name);
			if(res == null){
				res = map.get(name.toLowerCase());
			}
		}
		
		if(res == null){
			map = getResponseHeader();
			res = map.get(name);
		}
		
		if(res == null){
			res = getRequestHeader(name);
		}

		return res;
	}
	
	public static void setRequest(String name, Object value){
		Map<String, Object> map = getRequestMap();
		map.put(name, value);
	}
	
	public static void setRequestHead(String name, Object value) {
		Map<String, Object> map = getRequestHeader();
		map.put(name, value);
	}
	
	public static Object getRequest(String name){
		Object res = null;
		Map<String, Object> map = getRequestMap();
		res = map.get(name);
		
		if(res == null){
			res = map.get(name.toLowerCase());
		}
		
		if(res == null){
			res = getRequestHeader(name);
		}

		return res;
	}
	
	public static Object getResponse(String name){
		Object res = null;
		Map<String, Object> map = getResponseMap();
		res = map.get(name);
		
		if(res == null){
			map = getResponseHeader();
			res = map.get(name);
		}
		
		return res;
	}
	
	public static void set(List list){
		Map<String, Object> map = responseMapThreadLocal.get();
		if(map == null){
			map = new HashMap<String, Object>();
			responseMapThreadLocal.set(map);
		}
		map.put(KeyConstants.ResponseOnlyList, list);
	}
	
	public static void set(Map<String, Object> res){
		Map<String, Object> map = responseMapThreadLocal.get();
		if(map == null){
			map = new HashMap<String, Object>();
			responseMapThreadLocal.set(map);
		}
		map.clear();
		map.putAll(res);
	}
	
	public static void set(String key, Object value){
		Map<String, Object> map = responseMapThreadLocal.get();
		if(map == null){
			map = new HashMap<String, Object>();
			responseMapThreadLocal.set(map);
		}
		map.put(key, value);
	}
	
	public static void setAll(Map<String, Object> res){
		Map<String, Object> map = responseMapThreadLocal.get();
		if(map == null){
			map = new HashMap<String, Object>();
			responseMapThreadLocal.set(map);
		}
		map.putAll(res);
	}
	
	public static void setCurrentUser(IUser user){
		Map<String, Object> map = getRequestHeader();
		map.put(KeyConstants.CurrentUser, user);
	}
	
	public static IUser getCurrentUser(){
		Map<String, Object> map = getRequestHeader();
		IUser user = (IUser)map.get(KeyConstants.CurrentUser);
		return user;
	}
	
	public static void setCurrentUser(Map<String, Object> user){
		Map<String, Object> map = getRequestHeader();
		map.put(KeyConstants.CurrentUserMap, user);
	}
	
	public static Map<String, Object> getUserMap(){
		Map<String, Object> map = getRequestHeader();
		Map<String, Object> user = (Map<String, Object>) map.get(KeyConstants.CurrentUserMap);
		return user;
	}
	
	public static void setCurrentUseId(String userId) {
		Map<String, Object> map = getRequestHeader();
		if(map.containsKey(KeyConstants.CurrentUser)) {
			IUser user = (IUser)map.get(KeyConstants.CurrentUser);
			user.setLoginId(userId);
		}else {
			map.put(KeyConstants.CurrentUserId, userId);			
		}
	}
	
	public static String getCurrentUserId() {
		Map<String, Object> map = getRequestHeader();
		if(map.containsKey(KeyConstants.CurrentUser)) {
			IUser user = (IUser)map.get(KeyConstants.CurrentUser);
			return user.getLoginId();
		}
		return (String) map.get(KeyConstants.CurrentUserId);
	}
	
	public static long getCurrentUserSeq() {
		IUser user = getCurrentUser();
		if(user != null) {
			return user.getSeq();
		}
		return -1;
	}
	
	public static Map<String, Object> getCustomerSeqParam() {
		Map<String, Object> params = new HashMap<String, Object>();
		IUser user = getCurrentUser();
		if(user.getLoginCustomerSeq() > 0) {
			long cust = user.getLoginCustomerSeq();
			params.put("Customer", cust);
		}else if(TransData.containsParam("Customer")){
			params.put("Customer", TransData.getValueAsLong("Customer"));
		}
		return params;
	}
	
	public static void setCustomerSeqParam(Map<String, Object> params) {
		IUser user = TransData.getCurrentUser();
		long cust = user.getLoginCustomerSeq();
		if(cust > 0) {
			params.put("Customer", cust);
		}else {
			cust = TransData.getValueAsLong("Customer", -1);
			if(cust < 0) {
				throw new RuntimeException("miss.customer.seq");
			}
			params.put("Customer", cust);
		}
	}
	
	public static void setRequestObject(HttpServletRequest request, HttpServletResponse response){
		Map<String, Object> map = getRequestHeader();
		map.put(KeyConstants.RequestObject, request);
		map.put(KeyConstants.ResponseObject, response);
	}
	
	public static HttpServletRequest getRequestObject() {
		Map<String, Object> map = getRequestHeader();
		return (HttpServletRequest) map.get(KeyConstants.RequestObject);
	}
	
	public static HttpServletResponse getResponseObject() {
		Map<String, Object> map = getRequestHeader();
		return (HttpServletResponse) map.get(KeyConstants.ResponseObject);
	}
	
	public static void setResponseHead(String key, Object value){
		Map<String, Object> map = responseHeadThreadLocal.get();
		if(map == null){
			map = new HashMap<String, Object>();
			responseHeadThreadLocal.set(map);
		}
		map.put(key, value);
	}
	
	public static void setRawData(byte[] data, FileType contentType, String filename) {
		Date now = new Date();
		String dt = FormatUtility.formatDateTime(now, "yyyyMMddHHmmss");
		String fn = getValueAsString("FileName");
		if(StringUtility.isNullOrEmpty(fn)) {
			fn = filename;
		}else {
			fn = String.format("%s%s", fn, dt);
		}
		ResponseRawData raw = new ResponseRawData(data, contentType, fn);
		set(RawDataKey, raw);
	}
	
	public static ResponseRawData getRawDataResponse() {
		Object obj = getResponse(RawDataKey);
		if(obj == null) {
			return null;
		}
		return  (ResponseRawData)obj;
	}
	
	public static void setHtmlFragment(String html) {
		set(HtmlFragmentKey, html);
	}
	public static String getHtmlFragment() {
		Object obj = getResponse(HtmlFragmentKey);
		if(obj == null) {
			return null;
		}
		return (String)obj;
	}
	
	public static Map<String, Object> getAllHeaders(){
		Map<String, Object> map = new HashMap<String, Object>();
		map.putAll(getRequestHeader());
		return map;
	}
	
	public static Map<String, Object> getAllRequestParams(){
		Map<String, Object> map = new HashMap<String, Object>();
		map.putAll(getOrgReqMap());
		return map;
	}
	
	public static Map<String, Object> getAllResponseHeaders(){
		Map<String, Object> map = new HashMap<String, Object>();
		map.putAll(getResponseHeader());
		return map;
	}
	
	public static Map<String, Object> getAllResponseData(){
		Map<String, Object> map = new HashMap<String, Object>();
		map.putAll(getResponseMap());
		return map;
	}
		
	public static String getResponseHeader(String name){
		Map<String, Object> map = getResponseHeader();
		return ConvertUtility.getValueAsString(map.get(name));
	}
	
	public static boolean getValueAsBool(String name, boolean defaultvalue){
		return ConvertUtility.getValueAsBool(get(name), defaultvalue);
	}
	
	public static byte getValueAsByte(String name){
		return ConvertUtility.getValueAsByte(get(name));
	}
	
	public static byte getValueAsByte(String name, byte defvalue){
		return ConvertUtility.getValueAsByte(get(name), defvalue);
	}
	
	public static int getValueAsInt(String name){
		return ConvertUtility.getValueAsInt(get(name));
	}
	
	public static int getValueAsInt(String name, int defvalue){
		return ConvertUtility.getValueAsInt(get(name), defvalue);
	}
	
	public static long getValueAsLong(String name){
		return ConvertUtility.getValueAsLong(get(name));
	}
	
	public static long getValueAsLong(String name, long defvalue){
		return ConvertUtility.getValueAsLong(get(name),defvalue);
	}
	
	public static BigDecimal getValueAsBigDecimal(String name){
		return ConvertUtility.getValueAsBigDecimal(get(name));
	}
	
	public static BigInteger getValueAsBigInteger(String name){
		return ConvertUtility.getValueAsBigInteger(get(name));
	}
	
	public static String getValueAsString(String name){
		return ConvertUtility.getValueAsString(get(name));
	}
	
	public static double getValueAsDouble(String name, double defvalue){
		return ConvertUtility.getValueAsDouble(get(name), defvalue);
	}
	
	public static double getValueAsDouble(String name){
		return ConvertUtility.getValueAsDouble(get(name), 0d);
	}
	
	public static Date getValueAsDate(String name) {
		String tmstr = getValueAsString(name);
		if(StringUtility.isNullOrEmpty(tmstr)) {
			return new Date();
		}
		return FormatUtility.parseDateTime(tmstr, "yyyy-MM-dd HH:mm:ss");
	}
	
	public static boolean containsParam(String name){
		Map<String, Object> map = getRequestMap();
		Object obj = map.get(name);
		if(obj == null) {
			obj = map.get(name.toLowerCase());
			if(obj == null) {
				return false;
			}
			return true;
		}
		
		return true;
	}
	
	public static String getScheme(){
		return ConvertUtility.getValueAsString(getRequestHeader(KeyConstants.Scheme));
	}
	
	public static String getHost(){
		return ConvertUtility.getValueAsString(getRequestHeader(KeyConstants.Host));
	}
	
	public static int getPort(){
		return ConvertUtility.getValueAsInt(getRequestHeader(KeyConstants.Port));
	}
	
	public static int getMT(){
		return ConvertUtility.getValueAsInt(getRequestHeader(KeyConstants.MT));
	}
	
	public static int getPID(){
		return ConvertUtility.getValueAsInt(getRequestHeader(KeyConstants.PID));
	}
	
	public static String getIMEI(){
		return ConvertUtility.getValueAsString(getRequestHeader(KeyConstants.IMEI));
	}
	
	public static String getIMSI(){
		return ConvertUtility.getValueAsString(getRequestHeader(KeyConstants.IMSI));
	}
	
	public static String getCUID(){
		return ConvertUtility.getValueAsString(getRequestHeader(KeyConstants.CUID));
	}

	public static long getUID(){
		long uid = ConvertUtility.getValueAsLong(getRequestHeader(KeyConstants.UID), 0);
		if(uid == 0){
			Object obj = getSessionAttribute(KeyConstants.SessionUid);
			uid = ConvertUtility.getValueAsLong(obj, 0);
		}
		return uid;
	}

	public static String getSdkSessionId(){
		return ConvertUtility.getValueAsString(getRequestHeader(KeyConstants.SessionId));
	}
	
	public static String getDivideVersion(){
		return ConvertUtility.getValueAsString(getRequestHeader(KeyConstants.DivideVersion));
	}
		
	public static String getSupPhone(){
		return ConvertUtility.getValueAsString(getRequestHeader(KeyConstants.SupPhone));
	}
	
	public static String getSupFirm(){
		return ConvertUtility.getValueAsString(getRequestHeader(KeyConstants.SupFirm));
	}
	
	public static String getProtocolVersion(){
		return ConvertUtility.getValueAsString(getRequestHeader(KeyConstants.ProtocolVersion));
	}
	
	public static String getChannelID(){
		return ConvertUtility.getValueAsString(getRequestHeader(KeyConstants.ChannelID));
	}
	public static String getClientChannel(){
		return ConvertUtility.getValueAsString(getRequestHeader("ClientChannel"));
	}
	public static String getClientApp(){
		return ConvertUtility.getValueAsString(getRequestHeader("ClientApp"));
	}
	
	public static String getLanguage(){
		return ConvertUtility.getValueAsString(getRequestHeader(KeyConstants.Language));
	}
		
	public static String getCountryCode(){
		String countryCode = ConvertUtility.getValueAsString(getRequestHeader(KeyConstants.CountryCode));
		if(StringUtility.isNullOrEmpty(countryCode)){
			String[] langs = StringUtility.splitString(TransData.getLanguage(), '_');
			if(langs.length >= 2){
				countryCode = langs[1];
			}
		}
		return countryCode;
	}
	
	public static String getRealIp(){
		HttpServletRequest request = (HttpServletRequest)getRequestHeader(KeyConstants.RequestObject);
		return AppServerPathHelper.getClientIp(request);
	}
	
	public static String getRemoteAddr(){
		HttpServletRequest request = (HttpServletRequest)getRequestHeader(KeyConstants.RequestObject);
		return request.getRemoteAddr();
	}
	
	public static String getRealIpByCdn(){
		HttpServletRequest request = (HttpServletRequest)getRequestHeader(KeyConstants.RequestObject);
		return AppServerPathHelper.getClientIpByCdn(request);
	}
	
	public static String getServerSessionId(){
		HttpServletRequest request = (HttpServletRequest)getRequestHeader(KeyConstants.RequestObject);
		return request.getSession().getId();
	}
	
	public static Object getSessionAttribute(String attr){
		HttpServletRequest request = (HttpServletRequest)getRequestHeader(KeyConstants.RequestObject);
		return request.getSession().getAttribute(attr);
	}
	
	public static void setSessionAttribute(String attr, Object obj){
		HttpServletRequest request = (HttpServletRequest)getRequestHeader(KeyConstants.RequestObject);
		request.getSession().setAttribute(attr, obj);
	}
	
	public static Object getReqeustAttribute(String attr){
		HttpServletRequest request = (HttpServletRequest)getRequestHeader(KeyConstants.RequestObject);
		if(request == null) {
			return null;
		}
		return request.getAttribute(attr);
	}
	
	public static void setReqeustAttribute(String attr, Object obj){
		HttpServletRequest request = (HttpServletRequest)getRequestHeader(KeyConstants.RequestObject);
		request.setAttribute(attr, obj);
	}
	
	public static String getSign(){
		return ConvertUtility.getValueAsString(getRequestHeader(KeyConstants.Sign));
	}
	
	public static String getTransCode() {
		Map<String, Object> reqhead = getRequestHeader();
		return (String) reqhead.get(KeyConstants.TransCode);
	}
	
	public static String getNoRestTransCode() {
		Map<String, Object> reqhead = getRequestHeader();
		return (String) reqhead.get(KeyConstants.NoRestTransCode);		
	}
	
	public static void setNoRestTransCode(String transcode) {
		Map<String, Object> reqhead = getRequestHeader();
		reqhead.put(KeyConstants.NoRestTransCode, transcode);
	}

	
	public static List getParties(List list) {
		List res = new LinkedList();
		if (!TransData.hasPagination()) {
			return list;
		}
		int idx = TransData.getPageIndex();
		int sz = TransData.getPageSize();
		int sidx = (idx - 1) * sz;
		if (sidx < 0 || sidx >= list.size()) {
			return res;
		}
		int cnt = 0;
		for (Object map : list) {
			if (cnt < sidx) {
				cnt++;
				continue;
			}
			if (cnt >= sidx + sz) {
				break;
			}
			res.add(map);
			cnt++;
		}

		return res;
	}
	
	public static Map<String, List<Map<String, Object>>> groupData(List<Map<String, Object>> list, String groupKey){
		Map<String, List<Map<String, Object>>> map = new HashMap<String, List<Map<String, Object>>>();
		for(Map<String, Object> item : list) {
			String obj = ConvertUtility.getValueAsString(item.get(groupKey));
			if(obj == null) {
				continue;
			}
			List<Map<String, Object>> elem = map.get(obj);
			if(elem == null) {
				elem = new ArrayList<Map<String, Object>>();
				map.put(obj, elem);
			}
			elem.add(item);
		}
		
		return map;
	}
	
	public static List<Map<String, Object>> groupData(List<Map<String, Object>> list, String groupKey, String[] sublistkeys, String newkey){
		Map<String, List<Map<String, Object>>> group = groupData(list, groupKey);
		
		List<Map<String, Object>> res = new ArrayList<Map<String, Object>>();
		
		for(String itemkey : group.keySet()) {
			List<Map<String, Object>> itemlist = group.get(itemkey);
			Map<String, Object> map = new HashMap<String, Object>();
			Map<String, Object> itemap = itemlist.get(0);
			map.putAll(itemap);
			for(String subkey : sublistkeys) {
				map.remove(subkey);
			}
			
			List<Map<String, Object>> sublist = new ArrayList<Map<String, Object>>();
			
			for(Map<String, Object> item : itemlist) {
				Map<String, Object> newmap = new HashMap<String, Object>();
				for(String subkey : sublistkeys) {
					newmap.put(subkey, item.get(subkey));
				}
				sublist.add(newmap);
			}
			
			map.put(newkey, sublist);
			res.add(map);
		}
		
		return res;
	}
	
	static void setNoRestful(boolean flag, String transcode) {
		setReqeustAttribute(KeyConstants.NoRestful, flag);
		if(flag && !StringUtility.isNullOrEmpty(transcode)) {
			Map<String, Object> reqhead = getRequestHeader();
			reqhead.put(KeyConstants.TransCode, String.format("/norest/%s", transcode));			
		}
	}
	
	public static boolean isNoRestful() {
		Object flag = getReqeustAttribute(KeyConstants.NoRestful);
		boolean res = ConvertUtility.getValueAsBool(flag, false);
		return res;
	}
	
	static void setSSE(boolean flag) {
		setReqeustAttribute(SseKey, flag);
	}
	
	public static boolean isSSE() {
		Object flag = getReqeustAttribute(SseKey);
		boolean res = ConvertUtility.getValueAsBool(flag, false);
		return res;
	}
	
	public static Object getBean(Class cls) {
		Object obj = ApplicationContextProvider.getBean(cls);
		return obj;
	}
		
	public static Object getBean(String name) {
		Object obj = ApplicationContextProvider.getBean(name);
		return obj;
	}
		
}
