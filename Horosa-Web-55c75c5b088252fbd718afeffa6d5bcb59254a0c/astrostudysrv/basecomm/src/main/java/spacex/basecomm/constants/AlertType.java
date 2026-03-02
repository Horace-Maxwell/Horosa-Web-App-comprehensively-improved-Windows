package spacex.basecomm.constants;

public enum AlertType {
	NoAlert(-1),
	ErrorAlert(0),		// 各种错误，异常产生的报警
	DataAlert(1),		// 直接数据报警，数据0或1直接就代表报警
	AssistAlert(2),		// 辅助报警，数据超出阀值时的报警，或手工报警
	DiagnostAlert(3);	// 诊断报警，通过AI技术，系统自动判断出的报警
	
	private int code;
	private AlertType(int code){
		this.code = code;
	}
	
	public int getCode(){
		return this.code;
	}
}
