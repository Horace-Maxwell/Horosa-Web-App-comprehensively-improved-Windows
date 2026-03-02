package boundless.web.common;

import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import boundless.spring.help.interceptor.TransData;
import boundless.utility.FormatUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;
import boundless.web.help.TransUrlUtility;


public class CommonUser extends BaseUser {
	private static final long serialVersionUID = 1645350220895579638L;
	
	protected boolean isAdmin;
	protected boolean isIdAudit;
	protected boolean isAudit;
	protected boolean isEngineer;
	
	protected String department;
	protected String departmentName;
	protected long post;
	
	public long getPost() {
		return post;
	}

	public void setPost(long post) {
		this.post = post;
	}

	public String getPostName() {
		return postName;
	}

	public void setPostName(String postName) {
		this.postName = postName;
	}

	private String postName;
	
	public String getDepartment() {
		return department+"";
	}

	public void setDepartment(String department) {
		this.department = department;
	}

	public String getDepartmentName() {
		return departmentName;
	}

	public void setDepartmentName(String departmentName) {
		this.departmentName = departmentName;
	}

	private int type;
	
	private String avatar;
	
	private String name;
	private String nickName;
	private String mobile;
	private String email;
	private String qq;
	private String wechat;
	private String pwd;
	
	
	private byte idtype;
	private String idno;
	private byte sex;
	private long recomSeq;
	
	public long getRecomseq() {
		return recomSeq;
	}

	public void setRecomseq(long recomSeq) {
		this.recomSeq = recomSeq;
	}

	private long birthday;
	private long createtime;
	private long updatetime;
	
	private Enterprise loginCustomer;
	
	private String roles;
	private int[] roleArray = new int[0];
	
	private String realIp;
	private String token;
	private String actSysToken;
	private List<String> actSysRoles;

	private Map<String, Set<String>> transcodes = new HashMap<String, Set<String>>();
	private Set<String> menus = new HashSet<String>();
	private Set<String> customizeMenus = new HashSet<String>();
	private Map<String, Object> menuActionMap = new HashMap<String, Object>();
	
	public CommonUser(){
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getNickName() {
		return nickName;
	}

	public void setNickName(String nickName) {
		this.nickName = nickName;
	}

	public String getMobile() {
		return mobile;
	}

	public void setMobile(String tel) {
		this.mobile = tel;
	}

	public String getEmail() {
		return email;
	}

	public void setEmail(String email) {
		this.email = email;
	}

	public byte getIdtype() {
		return idtype;
	}

	public void setIdtype(byte idtype) {
		this.idtype = idtype;
	}

	public String getIdno() {
		return idno;
	}

	public void setIdno(String idno) {
		this.idno = idno;
	}

	public byte getSex() {
		return sex;
	}

	public void setSex(byte sex) {
		this.sex = sex;
	}

	public Long getBirthday() {
		return birthday == -1L ? null : birthday;
	}

	public void setBirthday(long birthday) {
		this.birthday = birthday;
	}

	public Long getCreatetime() {
		return createtime == -1L ? null : createtime;
	}

	public void setCreatetime(long createtime) {
		this.createtime = createtime;
	}

	public Long getUpdatetime() {
		return updatetime == -1L ? null : updatetime;
	}

	public void setUpdatetime(long updatetime) {
		this.updatetime = updatetime;
	}

	public boolean isAdmin() {
		return this.isAdmin;
	}

	public boolean isEngineer() {
		return this.isEngineer;
	}

	public boolean isSelf(){
		return this.loginCustomer == null;
	}
	
	public boolean isIdAudit(){
		return this.isIdAudit;
	}

	public String getAvatar() {
		return avatar;
	}

	public void setAvatar(String avatar) {
		this.avatar = avatar;
	}

	@Override
	public String getPassword() {
		return this.pwd;
	}

	@Override
	public void setPassword(String password) {
		this.pwd = password;
	}

	public String getCustomerNames(){
		return this.loginCustomer == null ? null : this.loginCustomer.name;
	}
	
	public String getCustomers(String customerseqs){
		return getCustomers();
	}
	
	public String getCustomers() {
		return this.loginCustomer == null ? "" + this.getLoginCustomerSeq() : this.loginCustomer.seq + "";
	}

	public long[] getCustomerArray() {
		if(this.loginCustomer == null){
			return new long[0];
		}
		return new long[]{ this.loginCustomer.seq };
	}
	
	public Set<Long> getCustomerSet(){
		Set<Long> set = new HashSet<Long>();
		if(this.loginCustomer != null){
			set.add(this.loginCustomer.seq);
		}
		return set;
	}
	
	public boolean isCustomerType(int type){
		if(this.loginCustomer == null){
			return false;
		}
		for(int t : this.loginCustomer.types){
			if(t == type){
				return true;
			}
		}
		return false;
	}
	
	public String getRoles() {
		return roles;
	}

	public void setRoles(String roles) {
		this.roles = roles;
		if(StringUtility.isNullOrEmpty(roles)){
			this.roleArray = new int[0];
			this.transcodes.clear();
			return;
		}
		this.roleArray = StringUtility.splitInt32(roles, ',');
	}

	public int[] getRoleArray() {
		return roleArray;
	}

	public void setRoleArray(int[] roleArray) {
		this.roleArray = roleArray;
	}
		
	public void setAdmin(boolean flag){
		this.isAdmin = flag;
	}

	public void setEngineer(boolean flag){
		this.isEngineer = flag;
	}

	public void setIdAudit(boolean flag){
		this.isIdAudit = flag;
	}

	public boolean isAudit() {
		return isAudit;
	}

	public void setAudit(boolean isAudit) {
		this.isAudit = isAudit;
	}

	public String getRealIp() {
		return realIp;
	}

	public void setRealIp(String realIp) {
		this.realIp = realIp;
	}

	public String getToken() {
		return token;
	}

	public void setToken(String token) {
		this.token = token;
	}

	public String getActSysToken() {
		return actSysToken;
	}

	public void setActSysToken(String actSysToken) {
		this.actSysToken = actSysToken;
	}

	public List<String> getActSysRoles() {
		return actSysRoles;
	}

	public void setActSysRoles(List<String> actSysRoles) {
		this.actSysRoles = actSysRoles;
	}

	public boolean permit(String srvsys, String path){
		if(this.isAdmin() && this.isSelf()) {
			return true;
		}
		boolean flag = TransUrlUtility.isUserPass(path) || TransUrlUtility.isCommonPass(path) ;
		Set<String> transet = this.transcodes.get(srvsys);
		if(transet == null) {
			return flag;
		}
		return flag || transet.contains(path);
	}
	
	public boolean permitMenu(String menuid){
		return (this.isAdmin() && this.isSelf()) || this.menus.contains(menuid);
	}
	
	public Set<String> getMenus(){
		Set<String> ids = new HashSet<String>();
		ids.addAll(this.menus);
		return ids;
	}
	
	public void addTransCodes(String transCodes){
		Set<String> funset = StringUtility.splitToStringSet(transCodes, ',');
		addTransCodes("mainsys", funset);
	}
	
	public void addTransCodes(String app, Set<String> transCodes){
		if(transCodes == null || StringUtility.isNullOrEmpty(app)) {
			return;
		}
		Set<String> set = this.transcodes.get(app);
		if(set == null) {
			set = new HashSet<String>();
			this.transcodes.put(app, set);
		}
		set.addAll(transCodes);
	}
	
	public void addMenus(String menuids){
		if(StringUtility.isNullOrEmpty(menuids)){
			return;
		}
		Set<String> menuset = StringUtility.splitToStringSet(menuids, ',');
		this.menus.addAll(menuset);
	}
	
	public void addMenus(Set<String> menuids) {
		this.menus.addAll(menuids);
	}
	
	public void addCustomizeMenus(String menuids){
		if(StringUtility.isNullOrEmpty(menuids)){
			return;
		}
		Set<String> menuset = StringUtility.splitToStringSet(menuids, ',');
		this.customizeMenus.addAll(menuset);
	}
	
	public Set<String> getCustomizeMenus(){
		Set<String> set = new HashSet<String>();
		set.addAll(customizeMenus);
		
		return set;
	}
	
	public void addMenuAction(String json) {
		if(!StringUtility.isNullOrEmpty(json)) {
			this.menuActionMap.putAll(JsonUtility.toDictionary(json));			
		}
	}
	
	public Map<String, Object> getMenuAction() {
		Map<String, Object> res = new HashMap<String, Object>();
		String app = TransData.getClientApp();
		for(Map.Entry<String, Object> entry : this.menuActionMap.entrySet()) {
			String key = entry.getKey();
			Object val = entry.getValue();
			String prefix = app+"`";
			if(key.startsWith(prefix)) {
				String mkey = key.substring(prefix.length());
				res.put(mkey, val);				
			}
		}
		return res;
	}

	public long getLoginCustomerSeq(){
		return this.loginCustomer == null ? 0 : this.loginCustomer.seq;
	}
	
	public Customer getLoginCustomer(){
		return this.loginCustomer;
	}
	
	public String getLoginCustomerId(){
		return this.loginCustomer == null ? null : this.loginCustomer.id;
	}
	
	public String getLoginCustomerName(){
		return this.loginCustomer == null ? null : this.loginCustomer.name;
	}
	
	public int getType() {
		return this.type;
	}
	
	public void setType(int type) {
		this.type = type;
	}
	
	public void setLoginCustomer(Customer cust){
		this.loginCustomer = (Enterprise)cust;
	}
	
	public String getQq() {
		return qq;
	}

	public void setQq(String qq) {
		this.qq = qq;
	}

	public String getWechat() {
		return wechat;
	}

	public void setWechat(String wechat) {
		this.wechat = wechat;
	}

	
	public Map<String, Object> toMap(){
		Map<String, Object> map = new HashMap<String, Object>();
		map.put("avatar", this.avatar);
		map.put("birthday", null);
		map.put("email", this.email);
		map.put("idno", this.idno);
		map.put("idtype", this.idtype);
		map.put("isAdmin", this.isAdmin);
		map.put("isIdAudit", this.isIdAudit);
		map.put("isAudit", this.isAudit);
		map.put("loginId", this.loginId);
		map.put("type", this.type);
		map.put("name", this.name);
		map.put("nickName", this.nickName);
		map.put("seq", this.seq);
		map.put("sex", this.sex);
		map.put("state", this.state);
		map.put("mobile", this.mobile);
		map.put("realIp", this.realIp);
		map.put("token", this.token);
		map.put("loginCustomer", this.loginCustomer);
		map.put("qq", this.qq);
		map.put("wechat", this.wechat);
		map.put("customer", this.getLoginCustomerSeq());
		map.put("menuAction", this.menuActionMap);
		map.put("department", this.department);
		map.put("departmentName", this.departmentName);
		map.put("post", this.post);
		map.put("postName", this.postName);
		
		if(this.birthday > 0){
			Date dt = FormatUtility.parseDateTime(this.birthday);
			map.put("birthday", FormatUtility.formatDateTime(dt, "yyyy-MM-dd HH:mm:ss"));
		}
		
		return map;
	}
}
