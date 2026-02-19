package spacex.basecomm.im;

import java.util.HashMap;
import java.util.Map;

import boundless.io.FileUtility;
import boundless.net.http.HttpClientUtility;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;
import boundless.utility.RandomUtility;
import boundless.utility.StringUtility;

public class TengXunIM implements ThirdPartIM {
	private static final long Expire = 3600000 * 24 * 365;

	private static final Map<Integer, String> ErrorMsg = new HashMap<Integer, String>();
	
	private static final String ApiCreateId = "https://console.tim.qq.com/v4/im_open_login_svc/account_import";

	static {
		String errjson = FileUtility.getStringFromClassPath("spacex/basecomm/im/TengXunErrCode.json");
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
	
	
	private String adminId;
	private long appId;
	private String key;
	private TLSSigAPIv2 sigApi;
	private byte[] userBuf;
	
	public TengXunIM(long appId, String key, String adminId, String salt) {
		this.appId = appId;
		this.key = key;
		this.adminId = adminId;
		sigApi = new TLSSigAPIv2(this.appId, this.key);
		try {
			if(StringUtility.isNullOrEmpty(salt)) {
				this.userBuf = null;
			}else {
				this.userBuf = salt.getBytes("UTF-8");							
			}
		}catch(Exception e) {
			this.userBuf = null;
		}
	}
	
	private String genUrlParams() {
		String usersig = this.sigApi.genSigWithUserBuf(this.adminId, Expire, this.userBuf);
		int ram = RandomUtility.random();
		String params = String.format("sdkappid=%d&identifier=%s&usersig=%s&random=%d&contenttype=json", this.appId, this.adminId, usersig, ram);
		return params;
	}
	
	private Map<String, Object> post(String url, Map<String, Object> params) {
		Map<String, String> headers = new HashMap<String, String>();
		Map<String, String> respHeadMap = new HashMap<String, String>();
		
		String jsonData = JsonUtility.encode(params);
		String json = HttpClientUtility.uploadString(url, headers, "application/json; charset=UTF-8", jsonData, respHeadMap);
		Map<String, Object> res = JsonUtility.toDictionary(json);
		return res;
	}
	
	@Override
	public IMAccount createId() {
		String urlparams = this.genUrlParams();
		String url = String.format("%s?%s", ApiCreateId, urlparams);

		String accid = StringUtility.getUUID().toLowerCase();
		String token = this.sigApi.genSigWithUserBuf(accid, Expire, this.userBuf);
		
		Map<String, Object> params = new HashMap<String, Object>();
		params.put("Identifier", accid);
		
		Map<String, Object> res = this.post(url, params);
		int code = ConvertUtility.getValueAsInt(res.get("ErrorCode"));
		if(code != 0) {
			String msg = (String) res.get("ErrorInfo");
			if(StringUtility.isNullOrEmpty(msg)) {
				msg = getErrorMsg(code);				
			}
			throw new RuntimeException(msg);			
		}
		
		return new IMAccount(accid, token);
	}

	@Override
	public String updateId(String accid) {
		return this.sigApi.genSigWithUserBuf(accid, Expire, this.userBuf);
	}

	@Override
	public void sendMsg(String from, String to, String txt) {
		
	}

	@Override
	public void sendTeamMsg(String from, String to, String txt) {
		
	}

}
