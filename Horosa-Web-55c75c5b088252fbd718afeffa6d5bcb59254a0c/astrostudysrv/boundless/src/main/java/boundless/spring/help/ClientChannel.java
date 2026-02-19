package boundless.spring.help;

public enum ClientChannel {
	Unknwon("0"),
	PC("pc"), 
	Server("server"),
	MobileWeb("mobileweb"),
	MobileApp("mobileapp"),
	ANDROID("android"),
	IOS("ios"),
	WeChat("wechat"),
	WeChatApp("wechatapp"),
	ThirdPart("thirdpart");
	
	private String code;
	private ClientChannel(String code) {
		this.code = code;
	}
	
	public String getCode() {
		return this.code;
	}
	
	public String toString() {
		return this.code;
	}
		
	public static ClientChannel fromCode(String code) {
		for(ClientChannel c : ClientChannel.values()) {
			if(c.getCode().equals(code)) {
				return c;
			}
		}
		return Unknwon;
	}
}
