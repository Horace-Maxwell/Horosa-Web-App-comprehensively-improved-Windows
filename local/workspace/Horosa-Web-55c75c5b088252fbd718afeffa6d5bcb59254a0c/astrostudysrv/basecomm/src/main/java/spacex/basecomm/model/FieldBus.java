package spacex.basecomm.model;

import java.util.Map;

import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;
import spacex.basecomm.constants.FieldBusProtocol;
import spacex.basecomm.helper.CypherHelper;

public class FieldBus {
	public FieldBusProtocol protocol;
	public String objectId;
	public String smartdev;
	public int port;
	public String ip;
	public String user;
	public String password;
	public int securityPolicy = -1;
	public int securityMode = -1;
	public int authtype = -1;
	
	public FieldBus(){
		
	}
	
	public FieldBus(Map<String, Object> map){
		int proto = ConvertUtility.getValueAsInt(map.get("Protocol"));
		this.protocol = FieldBusProtocol.fromCode(proto);
		this.objectId = (String) map.get("ObjectId");
		this.smartdev = (String) map.get("SmartDev");
		this.ip = (String) map.get("Ip");
		this.user = (String) map.get("User");
		this.password = (String) map.get("Password");
		if(!StringUtility.isNullOrEmpty(this.password)){
			this.password = CypherHelper.decryptByPublicKey(this.password);
		}
		if(map.get("SecurityMode") != null) {
			this.securityMode = ConvertUtility.getValueAsInt(map.get("SecurityMode"));
		}
		if(map.get("SecurityPolicy") != null) {
			this.securityPolicy = ConvertUtility.getValueAsInt(map.get("SecurityPolicy"));
		}
		if(map.get("AuthType") != null) {
			this.authtype = ConvertUtility.getValueAsInt(map.get("AuthType"));
		}
		
		switch(this.protocol){
		case Bacnet: 
			this.port = ConvertUtility.getValueAsInt(map.get("Port"), 47808);
			if(this.port == 0) {
				this.port = 47808;
			}
			break;
		case Modbus:
			this.port = ConvertUtility.getValueAsInt(map.get("Port"), 502);
			if(this.port == 0) {
				this.port = 502;
			}
			break;
		case OPCDA:
			this.port = ConvertUtility.getValueAsInt(map.get("Port"), 135);
			if(this.port == 0) {
				this.port = 135;
			}
			break;
		case OPCUA:
			this.port = ConvertUtility.getValueAsInt(map.get("Port"), 135);
			if(this.port == 0) {
				this.port = 135;
			}
			break;
		case BEM:
			this.port = ConvertUtility.getValueAsInt(map.get("Port"), 26689);
			if(this.port == 0) {
				this.port = 26689;
			}
			break;
		default:
			this.port = ConvertUtility.getValueAsInt(map.get("Port"), 0);
		}
	}
}
