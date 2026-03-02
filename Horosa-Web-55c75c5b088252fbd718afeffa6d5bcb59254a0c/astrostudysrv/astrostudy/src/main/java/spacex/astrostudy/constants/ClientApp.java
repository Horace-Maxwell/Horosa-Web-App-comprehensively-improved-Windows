package spacex.astrostudy.constants;

public enum ClientApp {
	Unknwon(0),
	AstroStudy(1),
	AstroStudyMobWeb(2),
	GameMoonHaSa(3),
	AndroidMoonHaSa(4),
	IOSMoonHaSa(5),
	WechatMoonHaSa(6),
	Test(100);
	
	private int code;
	private ClientApp(int code) {
		this.code = code;
	}
	
	public int getCode() {
		return this.code;
	}
		
	public static ClientApp fromCode(int code) {
		for(ClientApp c : ClientApp.values()) {
			if(c.getCode() == code) {
				return c;
			}
		}
		return Unknwon;
	}
}
