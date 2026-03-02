package spacex.basecomm.constants;

public enum ClientChannel {
	Unknwon(0),
	PC(1),
	Android(2),
	IOS(3),
	Gateway(4),
	WeChat(5),
	Period(6),
	Protocol(7),
	Server(8),
	MobileWeb(9),
	WeiXinPayment(20),
	TencentCloud(21),
	AliPayment(30),
	AliCloud(31),
	ProdSrv(40),
	WebSocket(50),
	MqttBoot(60),
	BaiduCloud(71),
	HuaweiCloud(81),
	ThirdPart(100);
	
	private int code;
	private ClientChannel(int code) {
		this.code = code;
	}
	
	public int getCode() {
		return this.code;
	}
		
	public static ClientChannel fromCode(int code) {
		for(ClientChannel c : ClientChannel.values()) {
			if(c.getCode() == code) {
				return c;
			}
		}
		return Unknwon;
	}
}
