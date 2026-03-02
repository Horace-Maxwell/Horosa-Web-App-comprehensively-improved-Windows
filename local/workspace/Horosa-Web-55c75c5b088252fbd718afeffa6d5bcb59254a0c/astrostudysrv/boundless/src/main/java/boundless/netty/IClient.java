package boundless.netty;

import org.slf4j.Logger;

import boundless.types.Closable;
import boundless.utility.IPUtility;
import boundless.utility.StringUtility;

public interface IClient extends PacketRegistor, Closable {
	void send(Datagram data);
	Datagram request(Datagram data, long timeoutInSec);
	Datagram request(Datagram data);
	String getServerIp();
	int getServerPort();
	Logger log();
	
	default public long getServerIpNum(){
		String ip = getServerIp();
		int port = getServerPort();
		if(StringUtility.isNullOrEmpty(ip)){
			return -1;
		}
		return IPUtility.convertToLong(ip, port);
	}


}
