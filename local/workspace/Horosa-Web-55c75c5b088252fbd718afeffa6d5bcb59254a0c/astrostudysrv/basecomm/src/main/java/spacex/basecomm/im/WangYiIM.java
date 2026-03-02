package spacex.basecomm.im;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import boundless.io.FileUtility;
import boundless.net.http.HttpClientUtility;
import boundless.security.ShaUtility;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class WangYiIM implements ThirdPartIM {	
	private static final Map<Integer, String> ErrorMsg = new HashMap<Integer, String>();
	
	private static final String ApiCreateId = "https://api.netease.im/nimserver/user/create.action";
	private static final String ApiUpdateId = "https://api.netease.im/nimserver/user/update.action";
	private static final String ApiSendMsg = "https://api.netease.im/nimserver/msg/sendMsg.action";
	private static final String ApiCreateTeam = "https://api.netease.im/nimserver/superteam/create.action";
	private static final String ApiDismissTeam = "https://api.netease.im/nimserver/superteam/dismiss.action";
	private static final String ApiInviteToTeam = "https://api.netease.im/nimserver/superteam/invite.action";
	private static final String ApiKickFromTeam = "https://api.netease.im/nimserver/superteam/kick.action";
	private static final String ApiTeamMembers = "https://api.netease.im/nimserver/superteam/getTlists.action";
	private static final String ApiJoinTeamsInfo = "https://api.netease.im/nimserver/team/joinTeams.action";
	
	static {
		String errjson = FileUtility.getStringFromClassPath("spacex/basecomm/im/WangYiErrCode.json");
		Map<String, Object> map = JsonUtility.toDictionary(errjson);
		for(Map.Entry<String, Object> entry : map.entrySet()) {
			ErrorMsg.put(ConvertUtility.getValueAsInt(entry.getKey()), (String) entry.getValue());
		}
	}
	
	public static String getErrorMsg(int code) {
		String msg = ErrorMsg.get(code);
		if(StringUtility.isNullOrEmpty(msg)) {
			return code + "";
		}
		return msg;
	}
	
	private String appKey;
	private String appSecret;
	
	public WangYiIM(String appKey, String appSecret) {
		this.appKey = appKey;
		this.appSecret = appSecret;
	}
	
	private Map<String, String> genHeader() {
		Map<String, String> map = new HashMap<String, String>();
		String nonce = StringUtility.getUUID();
		String ms = System.currentTimeMillis()/1000 + "";
		map.put("AppKey", this.appKey);
		map.put("Nonce", nonce);
		map.put("CurTime", ms);
		
		String plain = String.format("%s%s%s", this.appSecret, nonce, ms);
		String chksum = ShaUtility.getSha1(plain).toLowerCase();
		map.put("CheckSum", chksum);
		
		return map;		
	}
	
	private void checkError(Map<String, Object> res) {
		int code = ConvertUtility.getValueAsInt(res.get("code"));
		if(code != 200) {
			String msg = getErrorMsg(code);
			String desc = (String) res.get("desc");
			String errmsg = String.format("%s: %s", msg, desc);
			throw new RuntimeException(errmsg);								
		}
	}
	
	public IMAccount createId() {
		Map<String, String> header = this.genHeader();
		String accid = StringUtility.getUUID().toLowerCase();
		String token = StringUtility.getUUID().toLowerCase();
		
		Map<String, Object> params = new HashMap<String, Object>();
		params.put("accid", accid);
		params.put("token", token);
		String json = HttpClientUtility.httpPost(ApiCreateId, params, header);
		Map<String, Object> res = JsonUtility.toDictionary(json);
		checkError(res);
		
		Map<String, Object> info = (Map<String, Object>) res.get("info");
		IMAccount act = new IMAccount();
		act.accid = (String) info.get("accid");
		act.token = (String) info.get("token");
		
		return act;
	}

	public String updateId(String accid) {
		Map<String, String> header = this.genHeader();
		String token = StringUtility.getUUID().toLowerCase();
		
		Map<String, Object> params = new HashMap<String, Object>();
		params.put("accid", accid);
		params.put("token", token);
		String json = HttpClientUtility.httpPost(ApiUpdateId, params, header);
		Map<String, Object> res = JsonUtility.toDictionary(json);
		checkError(res);
		
		return token;
	}
	
	private void innerSendMsg(int ope, String from, String to, String txt) {
		Map<String, String> header = this.genHeader();
		Map<String, Object> params = new HashMap<String, Object>();
		params.put("from", from);
		params.put("to", to);
		params.put("ope", ope);
		params.put("type", 0);
		
		Map<String, Object> txtmap = new HashMap<String, Object>();
		txtmap.put("msg", txt);
		
		params.put("body", JsonUtility.encode(txtmap));
		
		String json = HttpClientUtility.httpPost(ApiSendMsg, params, header);
		Map<String, Object> res = JsonUtility.toDictionary(json);
		checkError(res);
		
	}
	
	public void sendMsg(String fromAccid, String toAccid, String txt) {
		innerSendMsg(0, fromAccid, toAccid, txt);
	}
	
	public void sendTeamMsg(String fromAccid, String toTeamid, String txt) {
		innerSendMsg(0, fromAccid, toTeamid, txt);
	}
	
	public String createTeam(String ownerAccid, List<String> memberAccid, String teamName, String inviteMsg) {
		Map<String, String> header = this.genHeader();
		Map<String, Object> params = new HashMap<String, Object>();
		params.put("owner", ownerAccid);
		params.put("inviteAccids", JsonUtility.encode(memberAccid));
		params.put("tname", teamName);
		params.put("msg", inviteMsg);
		params.put("joinmode", "0");
		params.put("beinvitemode", "1");
		
		String json = HttpClientUtility.httpPost(ApiCreateTeam, params, header);
		Map<String, Object> res = JsonUtility.toDictionary(json);
		checkError(res);
		
		String teamid = (String) res.get("tid");
		return teamid;
	}
	
	public void dismissTeam(String ownerAccid, String teamid) {
		Map<String, String> header = this.genHeader();
		Map<String, Object> params = new HashMap<String, Object>();
		params.put("owner", ownerAccid);
		params.put("tid", teamid);

		String json = HttpClientUtility.httpPost(ApiDismissTeam, params, header);
		Map<String, Object> res = JsonUtility.toDictionary(json);
		checkError(res);
		
	}
	
	public void inviteToTeam(String ownerAccid, String teamid, List<String> memberAccid, String inviteMsg) {
		Map<String, String> header = this.genHeader();
		Map<String, Object> params = new HashMap<String, Object>();
		params.put("owner", ownerAccid);
		params.put("tid", teamid);
		params.put("inviteAccids", JsonUtility.encode(memberAccid));
		params.put("msg", inviteMsg);

		String json = HttpClientUtility.httpPost(ApiInviteToTeam, params, header);
		Map<String, Object> res = JsonUtility.toDictionary(json);
		checkError(res);
		
	}
	
	public void kickFromTeam(String ownerAccid, String teamid, List<String> memberAccid) {
		Map<String, String> header = this.genHeader();
		Map<String, Object> params = new HashMap<String, Object>();
		params.put("owner", ownerAccid);
		params.put("tid", teamid);
		params.put("kickAccids", JsonUtility.encode(memberAccid));

		String json = HttpClientUtility.httpPost(ApiKickFromTeam, params, header);
		Map<String, Object> res = JsonUtility.toDictionary(json);
		checkError(res);
		
	}
	
	public List<Map<String, Object>> listTeamMembers(String teamid, long tm, int limit) {
		Map<String, String> header = this.genHeader();
		Map<String, Object> params = new HashMap<String, Object>();
		params.put("timetag", tm + "");
		params.put("tid", teamid);
		params.put("limit", limit + "");

		String json = HttpClientUtility.httpPost(ApiTeamMembers, params, header);
		Map<String, Object> res = JsonUtility.toDictionary(json);
		checkError(res);
		
		List<Map<String, Object>> list = (List<Map<String, Object>>)res.get("tlists");
		return list;
	}
	
	public List<Map<String, Object>> listJoinTeams(String accid) {
		Map<String, String> header = this.genHeader();
		Map<String, Object> params = new HashMap<String, Object>();
		params.put("accid", accid);

		String json = HttpClientUtility.httpPost(ApiJoinTeamsInfo, params, header);
		Map<String, Object> res = JsonUtility.toDictionary(json);
		checkError(res);
		
		List<Map<String, Object>> list = (List<Map<String, Object>>)res.get("infos");
		return list;
	}
	
	
}
