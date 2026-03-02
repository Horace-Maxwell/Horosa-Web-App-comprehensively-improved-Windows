package boundless.net.bacnet;


import com.serotonin.bacnet4j.LocalDevice;
import com.serotonin.bacnet4j.npdu.ip.IpNetwork;
import com.serotonin.bacnet4j.npdu.ip.IpNetworkBuilder;
import com.serotonin.bacnet4j.transport.DefaultTransport;
import com.serotonin.bacnet4j.transport.Transport;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.types.Tuple;
import boundless.utility.IPUtility;

public class BacnetLocalDeviceFactory {
	
	public static Tuple<String, LocalDevice> create(int deviceNumber, String routerIp, int port){
		String mainnet = routerIp.substring(0, routerIp.lastIndexOf('.'));
		String[] ips = IPUtility.getLocalBroadcastIps();
		Short[] masks = IPUtility.getSubnetMasks();
		for(int i=0; i<ips.length; i++){
			String ip = ips[i];
			String net = ip.substring(0, ip.lastIndexOf('.'));
			if(!mainnet.equalsIgnoreCase(net)) {
				continue;
			}
			
			int mask = masks[i];
	        IpNetwork network = new IpNetworkBuilder().withBroadcast(ip, mask).withPort(port).build();
	        Transport transport = new DefaultTransport(network);
	        LocalDevice dev = new LocalDevice(deviceNumber, transport);
	        try {
	            dev.initialize();		            
	            return new Tuple<String, LocalDevice>(ip, dev);
	        } catch (Exception e) {
	            QueueLog.error(AppLoggers.ErrorLogger, e);
	        }
		}
		
		return null;
	}
	
	
}
