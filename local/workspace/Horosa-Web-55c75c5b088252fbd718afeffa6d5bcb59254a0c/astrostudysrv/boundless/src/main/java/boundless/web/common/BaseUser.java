package boundless.web.common;

import java.util.HashMap;
import java.util.Map;

public class BaseUser implements IUser {

	private static final long serialVersionUID = 6460472114521697616L;
	
	protected long seq;
	protected String loginId;

	protected byte state;
	
	public BaseUser() {
		
	}
	
	public BaseUser(long seq, String id) {
		this.seq = seq;
		this.loginId = id;
		this.state = 0;
	}
	
	public boolean isAdmin() {
		return seq == -1;
	}

	public long getSeq() {
		return seq;
	}

	public void setSeq(long seq) {
		this.seq = seq;
	}

	public String getLoginId() {
		return loginId;
	}

	public void setLoginId(String loginId) {
		this.loginId = loginId;
	}

	public byte getState() {
		return state;
	}

	public void setState(byte state) {
		this.state = state;
	}
	
	public boolean permit(String srvsys, String path) {
		return isAdmin();
	}

	@Override
	public Map<String, Object> toMap() {
		Map<String, Object> map = new HashMap<String, Object>();
		map.put("seq", this.seq);
		map.put("loginId", this.loginId);
		map.put("state", this.state);
		
		return map;
	}


}
