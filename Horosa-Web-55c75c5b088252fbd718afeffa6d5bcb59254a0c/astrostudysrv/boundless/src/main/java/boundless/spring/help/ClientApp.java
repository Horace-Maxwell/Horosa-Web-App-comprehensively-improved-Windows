package boundless.spring.help;


public enum ClientApp {
	Unknwon("0"),
	CloudSrv("cloudsrv"),
	KjtHome("kjthome"),
	KjtAdmin("kjtadmin"),
	UserPriv("userpriv"),
	Test("100"),
	SpaceX("spacex");
	
	private String code;
	private ClientApp(String code) {
		this.code = code;
	}
	
	public String getCode() {
		return this.code;
	}
	
	public String toString() {
		return this.code;
	}
		
	public static ClientApp fromCode(Object code) {
		String codeint = code.toString();
		for(ClientApp c : ClientApp.values()) {
			if(c.getCode().equals(codeint)) {
				return c;
			}
		}	

		return Unknwon;
	}
}
