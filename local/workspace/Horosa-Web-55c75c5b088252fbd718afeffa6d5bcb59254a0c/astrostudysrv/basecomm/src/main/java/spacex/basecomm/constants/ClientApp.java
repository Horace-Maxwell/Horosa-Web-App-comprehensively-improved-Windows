package spacex.basecomm.constants;

import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;

public enum ClientApp {
	Unknwon(0),
	BemAdmin(1),
	BemGateway(2),
	WeChatPerApp(3),
	WeChatEntApp(4),
	MobilePerApp(5),
	MobileEntPropApp(6),
	BemEntWeb(7),
	BemPerWeb(8),
	BemPeriod(9),
	BemProtocol(10),
	WeiXinNotify(20),
	TencentCloud(21),
	AliNotify(30),
	AliCloud(31),
	BemCloudSrv(40),
	BemWebSocket(50),
	BemMqttBoot(60),
	BaiduCloud(71),
	HuaweiCloud(81),
	Test(100);
	
	private int code;
	private ClientApp(int code) {
		this.code = code;
	}
	
	public int getCode() {
		return this.code;
	}
		
	public static ClientApp fromCode(Object code) {
		if(code instanceof Integer) {
			int codeint = (int) code;
			for(ClientApp c : ClientApp.values()) {
				if(c.getCode() == codeint) {
					return c;
				}
			}	
		}else {
			if(StringUtility.isNumeric(code.toString())) {
				int codeint = ConvertUtility.getValueAsInt(code);
				for(ClientApp c : ClientApp.values()) {
					if(c.getCode() == codeint) {
						return c;
					}
				}					
			}			
		}
		return Unknwon;
	}
}
