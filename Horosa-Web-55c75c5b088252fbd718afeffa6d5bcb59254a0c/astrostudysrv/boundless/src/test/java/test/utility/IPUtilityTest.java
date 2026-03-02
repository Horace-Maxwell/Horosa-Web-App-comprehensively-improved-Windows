package test.utility;

import boundless.utility.IPUtility;
import boundless.utility.StringUtility;

public class IPUtilityTest {

	public static void main(String[] args) {
		String[] ips = IPUtility.getLocalIps();
		for(String ip : ips){
			System.out.println(ip);
		}
		System.out.println();
		
		
		IPUtility.printReachableIP("127.0.0.1", 7531);
		
		boolean flag = IPUtility.isReachable(IPUtility.getLocalIps()[0], "127.0.0.1", 7531);
		System.out.println("180.97.81.66:7531 reachable:" + flag);
		
//		String[] servers = new String[]{"192.168.10.1", "192.168.1.1", "192.168.5.1", "192.168.2.1", "192.168.0.1"};
//		String[] res = IPUtility.sortNearIps(servers);
//		for(String ip : res){
//			System.out.println(ip);
//		}
//		
//		String bin = IPUtility.toBinaryString(IPUtility.convert("192.168.10.1"));
//		System.out.println(bin);
//				
//		System.out.println(StringUtility.joinWithSeperator(",", ips));
//		
//		System.out.println("ip:"+IPUtility.getSameAreaIp("192.168.1.100"));
//		System.out.println("ip:"+IPUtility.getSameAreaIp("122.168.1.100"));
//		System.out.println("ip:"+IPUtility.getSameAreaIp("adasdf0"));
	}

}
