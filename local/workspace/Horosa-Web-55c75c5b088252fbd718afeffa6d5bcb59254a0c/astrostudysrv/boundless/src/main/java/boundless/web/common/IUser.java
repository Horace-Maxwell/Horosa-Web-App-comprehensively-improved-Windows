package boundless.web.common;

import java.io.Serializable;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import boundless.spring.help.PropertyPlaceholder;


/**
 * 用户
 * @author zjf
 *
 */
public interface IUser extends Serializable {

	default public long getSeq() {
		return 0;
	}

	default public void setSeq(long seq) {
	}
	default public long getRecomseq() {
		return 0;
	}

	default public void setRecomseq(long recomSeq) {
	}
	public String getLoginId();

	default public void setLoginId(String loginId) {
	}

	default public String getPassword() {
		return null;
	}

	default public void setPassword(String password) {
	}

	default public byte getState() {
		return (byte)0;
	}

	default public void setState(byte state) {
	}

	default public String getName() {
		return null;
	}

	default public void setName(String name) {
	}

	default public String getNickName() {
		return null;
	}

	default public void setNickName(String nickName) {
	}

	default public String getMobile() {
		return null;
	}

	default public void setMobile(String tel) {
	}

	default public String getEmail() {
		return null;
	}

	default public void setEmail(String email) {
	}

	default public byte getIdtype(){
		return 0;
	}

	default public void setIdtype(byte idtype) {
	}

	default public String getIdno() {
		return null;
	}

	default public void setIdno(String idno) {
	}

	default public byte getSex(){
		return 1;
	}

	default public void setSex(byte sex) {
	}

	default public Long getBirthday(){
		return null;
	}

	default public void setBirthday(long birthday) {
	}

	default public Long getCreatetime(){
		return null;
	}

	default public void setCreatetime(long createtime) {
	}

	default public Long getUpdatetime(){
		return null;
	}

	default public void setUpdatetime(long updatetime) {
	}
	
	default public boolean isAdmin(){
		return false;
	}

	default public boolean isEngineer(){
		return false;
	}
	
	default public boolean isIdAudit(){
		return false;
	}
	
	default public void setIdAudit(boolean flag) {
	}
	
	default public void setAudit(boolean isAudit) {
	}

	default public boolean isAudit(){
		return false;
	}

	default public boolean isSelf(){
		return false;
	}
	
	default public String getJob(){
		return null;
	}
	default public String getJobCode(){
		return null;
	}

	default public void setMaintainer(boolean maintainer) {
	}

	default public String getCustomers(String customerseqs){
		return null;
	}
	
	default public String getCustomers(){
		return null;
	}

	default public long[] getCustomerArray(){
		return new long[0];
	}
			
	default public boolean isCustomerType(int type){
		return false;
	}
	
	default public Set<Long> getCustomerSet(){
		return new HashSet<Long>();
	}

	default public String getRoles(){
		return null;
	}

	default public void setRoles(String roles) {
	}

	default public int[] getRoleArray(){
		return new int[0];
	}

	default public void setRoleArray(int[] roleArray) {
	}

	default public String getToken(){
		return null;
	}

	default public void setToken(String token) {
	}
	
	default public String getRealIp(){
		return null;
	}

	default public void setRealIp(String token) {
	}
	
	default public String getActSysToken(){
		return null;
	}

	default public void setActSysToken(String token) {
	}
	
	default public List<String> getActSysRoles(){
		return new LinkedList<String>();
	}

	default public void setActSysRoles(List<String> token) {
	}
	
	default public boolean permit(String srvsys, String path){
		return true;
	}
	
	default public boolean permitMenu(String menuid){
		return false;
	}
	
	default public void addTransCodes(String transCodes){
	}
	
	default public void addTransCodes(String app, Set<String> transCodes){
	}
		
	default public void addMenus(String menus){
	}
	
	default public void addMenus(Set<String> menuids) {
		
	}

	default public void addCustomizeMenus(String menus){
	}
	
	default public Set<String> getCustomizeMenus(){
		return new HashSet<String>();
	}
	
	default public void addMenuAction(String json) {}
	
	default public String getCustomerNames() {
		return null;
	}
	
	default public String getAvatar(){
		return null;
	}
	
	default public Map<String, Object> toMap(){
		return new HashMap<String, Object>();
	}
	
	default public long getLoginCustomerSeq(){
		return -1;
	}
	
	default public String getLoginCustomerId(){
		return null;
	}
	
	default public String getLoginCustomerName(){
		return null;
	}
	
	default public String getDomain(){
		return null;
	}
	
	default public String getServiceZone(){
		return null;
	}
	
	default public int getResponseTime(){
		return 0;
	}
	
	default public Customer getLoginCustomer(){
		return null;
	}
	default public void setLoginCustomer(Customer customer){
		return;
	}
	
	default public long getSubjection() {
		return -1;
	}
	
	default public void setSubjection(long subjectionSeq) {
	}
	
	default public int getType() { return 0; }
	default public void setType(int t) {}
	
	default public String getDepartment() { return null; }
	default public String getDepartmentName() { return null; }
	
	default public Map<String, Object> getMenuAction() { return new HashMap<String, Object>(); }
	
	default public Set<String> getMenus() { return new HashSet<String>(); }
	
}
