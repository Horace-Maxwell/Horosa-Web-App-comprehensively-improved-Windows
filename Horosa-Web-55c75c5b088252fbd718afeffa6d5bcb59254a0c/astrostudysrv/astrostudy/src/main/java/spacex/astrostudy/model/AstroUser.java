package spacex.astrostudy.model;

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import boundless.spring.help.interceptor.TransData;
import boundless.types.ICache;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;
import boundless.web.common.BaseUser;
import boundless.web.common.IUser;
import boundless.web.help.TransUrlUtility;
import spacex.astrostudy.helper.AstroCacheHelper;
import spacex.astrostudy.helper.TransGroupHelper;

public class AstroUser extends BaseUser {
	/**
	 * 
	 */
	private static final long serialVersionUID = 8837250928906440841L;
	
	public static AstroUser fromMap(Map<String, Object> map) {
		AstroUser user = new AstroUser();
		user.gpsLat = ConvertUtility.getValueAsDouble(map.get("gpsLat"));
		user.gpsLon = ConvertUtility.getValueAsDouble(map.get("gpsLon"));
		user.setZodiacal(ConvertUtility.getValueAsByte(map.get("zodiacal")));
		user.setLat((String) map.get("lat"));
		user.setLon((String) map.get("lon"));
		user.setLoginId((String) map.get("uid"));
		user.setPassword((String)map.get("password"));
		user.setRegTime((long)map.get("regTime"));
		user.setHsys(ConvertUtility.getValueAsInt(map.get("hsys")));
		user.setTradition(ConvertUtility.getValueAsByte(map.get("tradition")));
		user.setPdtype(ConvertUtility.getValueAsByte(map.get("pdtype")));
		user.setStrongReception(ConvertUtility.getValueAsByte(map.get("strongRecption")));
		user.setVirtualPntReceiveAsp(ConvertUtility.getValueAsByte(map.get("virtualPntReceiveAsp")));
		user.setPredictive(ConvertUtility.getValueAsByte(map.get("predictive")));
		user.setPdaspects((String)map.get("pdaspects"));
		user.setSimpleAsp(ConvertUtility.getValueAsByte(map.get("simpleAsp")));
		user.setAd(ConvertUtility.getValueAsByte(map.get("ad")));
		user.setDoubingSu28(ConvertUtility.getValueAsByte(map.get("doubingSu28")));
		user.setPrivilege(ConvertUtility.getValueAsLong(map.get("privilege"), 0));
		
		Map<String, Object> superadminMap = AstroCacheHelper.getSuperAdmin(user.getLoginId());
		boolean superadmin = false;
		if(superadminMap != null) {
			superadmin = ConvertUtility.getValueAsBool(superadminMap.get("v"), false);
		}
		boolean admin = ConvertUtility.getValueAsBool(map.get("admin"), false);
		user.setAdmin(admin || superadmin);
		
		int superlevel = 0;
		if(superadminMap != null) {
			superlevel = ConvertUtility.getValueAsInt(superadminMap.get("level"), 0);
		}
		user.setSuperAdminLevel(superlevel);
		
		Object grp = map.get("group");
		if(grp != null) {
			if(grp instanceof String) {
				List<String> list = JsonUtility.decodeList((String)grp, String.class);
				user.addGroup(list);
			}else if(grp instanceof Collection) {
				user.addGroup((Collection)grp);
			}			
		}
		
		Object transcodes = map.get("transcodes");
		if(transcodes != null) {
			if(transcodes instanceof String) {
				List<String> list = JsonUtility.decodeList((String)transcodes, String.class);
				user.addTransCodes(list);
			}else if(transcodes instanceof Collection) {
				user.addTransCodes((Collection)transcodes);
			}			
		}

		Set<String> codes = TransGroupHelper.getCommTransCodes();
		user.addTransCodes(codes);
						
		return user;
	}
	
	private boolean admin = false;
	private String token;	
	private String uid;
	private String password;
	private long regTime = System.currentTimeMillis();
	private int hsys = 0;
	private byte tradition = 1;
	private byte pdtype = 1;
	private byte strongReception = 0;
	private byte virtualPntReceiveAsp = 1;
	private byte simpleAsp = 0;
	private byte predictive = 1;
	private String pdaspects = "0,60,90,120,180";
	private String lat = "26n05";
	private String lon = "119e18";
	private byte zodiacal = 0;
	public double gpsLon;
	public double gpsLat;
	public int ad = 1;
	
	public byte doubingSu28 = 0;
	public long privilege = 0;
	private int superAdminLevel = 0;
	
	public Set<String> group = new HashSet<String>();
	
	private Set<String> transcodes = new HashSet<String>();
	
	public int getSuperAdminLevel() {
		return this.superAdminLevel;
	}
	public void setSuperAdminLevel(int level) {
		this.superAdminLevel = level;
	}
		
	public boolean isAdmin() {
		return this.admin;
	}
	public void setAdmin(boolean value) {
		this.admin = value;
	}

	public void addTransCodes(String transCodes){
		Set<String> funset = StringUtility.splitToStringSet(transCodes, ',');
		this.transcodes.addAll(funset);
	}
	
	public void addTransCodes(Collection<String> transCodes){
		this.transcodes.addAll(transCodes);
	}
	
	public byte getZodiacal() {
		return zodiacal;
	}
	public void setZodiacal(byte zodiacal) {
		this.zodiacal = zodiacal;
	}
	
	@Override
	public String getLoginId() {
		return uid;
	}
	public void setLoginId(String uid) {
		this.uid = uid;
	}

	public String getPassword() {
		return password;
	}
	public void setPassword(String pwd) {
		this.password = pwd;
	}
	
	public String getToken() {
		return token;
	}
	public void setToken(String token) {
		this.token = token;
	}
	
	public long getRegTime() {
		return regTime;
	}
	public void setRegTime(long regTime) {
		this.regTime = regTime;
	}
	
	public int getHsys() {
		return hsys;
	}
	public void setHsys(int hsys) {
		this.hsys = hsys;
	}
	
	
	public byte getTradition() {
		return tradition;
	}
	public void setTradition(byte tradition) {
		this.tradition = tradition;
	}
	
	public byte getStrongReception() {
		return strongReception;
	}
	public void setStrongReception(byte strongReception) {
		this.strongReception = strongReception;
	}
	
	public byte getVirtualPntReceiveAsp() {
		return virtualPntReceiveAsp;
	}
	public void setVirtualPntReceiveAsp(byte virtualPntReceiveAsp) {
		this.virtualPntReceiveAsp = virtualPntReceiveAsp;
	}
	
	public byte getSimpleAsp() {
		return simpleAsp;
	}
	public void setSimpleAsp(byte simpleAsp) {
		this.simpleAsp = simpleAsp;
	}
	
	public byte getPredictive() {
		return predictive;
	}
	public void setPredictive(byte predictive) {
		this.predictive = predictive;
	}
	
	public String getPdaspects() {
		return pdaspects;
	}
	public void setPdaspects(String pdaspects) {
		this.pdaspects = pdaspects;
	}
	public Set<Integer> getPdAspectsSet(){
		if(StringUtility.isNullOrEmpty(pdaspects)) {
			return new HashSet<Integer>();
		}
		return StringUtility.splitToIntSet(pdaspects, ',');
	}
		
	public String getLat() {
		return lat;
	}
	public void setLat(String lat) {
		this.lat = lat;
	}
	
	public String getLon() {
		return lon;
	}
	public void setLon(String lon) {
		this.lon = lon;
	}
	
	public int getAd() {
		return ad;
	}
	public void setAd(int ad) {
		this.ad = ad;
	}
		
	public byte getDoubingSu28() {
		return doubingSu28;
	}
	public void setDoubingSu28(byte doubingSu28) {
		this.doubingSu28 = doubingSu28; 
	}
	
	public byte getPdtype() {
		return pdtype;
	}
	public void setPdtype(byte pdtype) {
		this.pdtype = pdtype;
	}
	
	
	public long getPrivilege() {
		return privilege;
	}
	public void setPrivilege(long privilege) {
		this.privilege = privilege;
	}
	
	@Override
	public boolean permit(String srvsys, String path) {
		if(TransUrlUtility.isUserPass(path) || TransUrlUtility.isCommonPass(path)) {
			return true;
		}
		
		if(this.isAdmin()) {
			int level = this.getSuperAdminLevel();
			if(level < 0) {
				return true;
			}
			String app = TransData.getClientApp();
			if(TransGroupHelper.permitTransCode(app, path)) {
				return true;
			}
			return false;
		}
		
		return this.transcodes.contains(path);
	}
	
	public boolean permit(long val) {
		if(this.isAdmin()) {
			return true;
		}
		return (this.privilege & val) == 1;
	}
	
	public void addGroup(Collection<String> group) {
		this.group.addAll(group);
	}
	
	public void setGroup(Set<String> set) {
		this.group = set;
	}
	
	public Map<String, Object> toMap(){
		Map<String, Object> map = new HashMap<String, Object>();
		map.put("hsys", this.hsys);
		map.put("password", this.password);
		map.put("pdaspects", this.pdaspects);
		map.put("predictive", this.predictive);
		map.put("pdtype", this.pdtype);
		map.put("regTime", this.regTime);
		map.put("simpleAsp", this.simpleAsp);
		map.put("strongRecption", this.strongReception);
		map.put("tradition", this.tradition);
		map.put("uid", this.uid);
		map.put("virtualPntReceiveAsp", this.virtualPntReceiveAsp);
		map.put("lat", this.lat);
		map.put("lon", this.lon);
		map.put("gpsLon", gpsLon);
		map.put("gpsLat", gpsLat);
		map.put("zodiacal", zodiacal);
		map.put("ad", ad);
		map.put("doubingSu28", doubingSu28);
		map.put("group", group);
		map.put("admin", admin);
		map.put("transcodes", transcodes);
		map.put("privilege", this.privilege);
		
		return map;
	}
}
