package boundless.netty;

import java.io.Serializable;
import java.util.List;
import java.util.Map;

import boundless.utility.ConvertUtility;
import boundless.utility.IPUtility;

public class ServerAddress implements Serializable{
	private static final long serialVersionUID = -3297022801490689382L;
	
	public static long getDistinctCode(int ip, int port){
		long res = ip;
		res = (res << 32) | port;
		return res;
	}
	
	public static long getDistinctCode(String ip, int port){
		int ipvalue = IPUtility.convert(ip);
		return getDistinctCode(ipvalue, port);
	}

	public static String decodeIpFromDistinctCode(long code){
		int num = (int) ((code >> 32) & 0xffffffff);
		return IPUtility.convert(num);
	}
	
	public static int decodePortFromDistinctCode(long code){
		int num = (int) (code & 0xffff);
		return num;
	}

	public ServerAddress(){
		
	}
	
	public ServerAddress(Map map){
		this.reachableIp = ConvertUtility.getValueAsString(map.get("reachableIp"));
		this.ip = ConvertUtility.getValueAsString(map.get("ip"));
		this.port = ConvertUtility.getValueAsInt(map.get("port"));
		this.type = ConvertUtility.getValueAsInt(map.get("type"));
		
		List iplist = (List) map.get("internalIps");
		if(iplist == null || iplist.isEmpty()){
			this.internalIps = new String[0];
		}else{
			this.internalIps = new String[iplist.size()];
			for(int i=0; i<iplist.size(); i++){
				this.internalIps[i] = iplist.get(i).toString();
			}
		}
	}
	
	public ServerAddress(String ip, int port){
		this(ip, port, null);
	}
	
	public ServerAddress(String ip, int port, List iplist){
		this.ip = ip;
		this.port = port;
		if(iplist == null || iplist.isEmpty()){
			this.internalIps = new String[0];
		}else{
			this.internalIps = new String[iplist.size()];
			for(int i=0; i<iplist.size(); i++){
				this.internalIps[i] = iplist.get(i).toString();
			}
		}
	}

	public int type;
	public String[] internalIps;
	public String ip;
	public int port;
	
	public String reachableIp;
		
	public long getDistinctCode(){
		return getDistinctCode(this.ip, this.port);
	}

	public boolean isSame(String ip, int port){
		return this.ip.equals(ip) && this.port == port;
	}
}
