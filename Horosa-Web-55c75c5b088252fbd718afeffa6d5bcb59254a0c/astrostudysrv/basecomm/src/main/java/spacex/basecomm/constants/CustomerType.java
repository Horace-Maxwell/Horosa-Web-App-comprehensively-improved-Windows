package spacex.basecomm.constants;

public enum CustomerType {

	Platform_User(0),	//平台用户
	PARTNER(1),		// 合作伙伴
	AGENT(2),		// 代理商
	PROVIDER(3),		// 供应商
	SERVICE_PROVIDER(4);	// 固定服务商

	private int code;
	private CustomerType(int code){
		this.code = code;
	}
	
	public int getCode(){
		return this.code;
	}
}
