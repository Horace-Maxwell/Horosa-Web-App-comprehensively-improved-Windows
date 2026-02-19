package boundless.utility;

import java.lang.management.ManagementFactory;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.Socket;
import java.net.SocketAddress;
import java.net.SocketException;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TimerTask;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.management.MBeanServer;
import javax.management.ObjectName;
import javax.management.Query;
import javax.servlet.http.HttpServletRequest;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.net.http.HttpClientUtility;
import boundless.types.KeyValuePair;
import boundless.types.OutParameter;
import boundless.types.Tuple;

/**
 * IP转换工具包
 *
 */
public final class IPUtility {
	private static String[] localIps;
	private static String[] broadIps;
	private static Short[] masks;

	private static TimerTask task = new TimerTask(){
		@Override
		public void run() {
			getLocalIps();
		}
	};
	
	public static void build(){
		PeriodTask.submit(task, 0, 3600*1000);
	}
	
	
	/**
	 * 将IP转换为无符号32位数
	 * @param ip
	 * @return
	 */
	public static int convert(String ip){
		if(StringUtility.isNullOrEmpty(ip)){
			return 0;
		}
		
		long[] addr = StringUtility.splitUInt32(ip, '.');

		int result = 0;

		if (addr.length == 4)
		{
			result |= (addr[3] << 24);
			result |= (addr[2] << 16);
			result |= (addr[1] << 8);
			result |= addr[0];
		}

		return result;
	}
	
	public static String[] convert(int[] ips){
		String[] res = new String[ips.length];
		for(int i=0; i<res.length; i++){
			res[i] = convert(ips[i]);
		}
		return res;
	}
	
	public static String convertInverse(int ipNum)
	{
		StringBuilder ipBuilder = new StringBuilder();

		ipBuilder.append((ipNum >> 24) & 0xFF);
		ipBuilder.append('.');
		ipBuilder.append((ipNum & 0x00FFFFFF) >> 16);
		ipBuilder.append('.');
		ipBuilder.append((ipNum & 0x0000FFFF) >> 8);
		ipBuilder.append('.');
		ipBuilder.append((ipNum & 0x000000FF));

		return ipBuilder.toString();
	}
	
	public static String convertToIPInverse(long ipNum)
	{
		StringBuilder ipBuilder = new StringBuilder();

		ipBuilder.append((ipNum >> 24) & 0xFF);
		ipBuilder.append('.');
		ipBuilder.append((ipNum & 0x00FFFFFF) >> 16);
		ipBuilder.append('.');
		ipBuilder.append((ipNum & 0x0000FFFF) >> 8);
		ipBuilder.append('.');
		ipBuilder.append((ipNum & 0x000000FF));

		return ipBuilder.toString();
	}

	/**
	 * 将IP转换为无符号32位数
	 * @param ip
	 * @return
	 */
	public static long convertToLong(String ip){
		if(StringUtility.isNullOrEmpty(ip)){
			return 0;
		}
		
		long[] addr = StringUtility.splitUInt32(ip, '.');

		long result = 0;

		if (addr.length == 4)
		{
			result |= (addr[3] << 24);
			result |= (addr[2] << 16);
			result |= (addr[1] << 8);
			result |= addr[0];
		}

		return result;
	}
	
	public static long convertToLong(String ip, int port){
		long ipnum = convertToLong(ip);
		long res = ipnum << 32;
		res |= (0xffffl & port);
		return res;
	}

	public static long convertToLong(int ipnum, int port){
		long res = ((long)ipnum) << 32;
		res |= (0xffffl & port);
		return res;
	}

	public static long convertToLongReverse(String ip) {
		if(StringUtility.isNullOrEmpty(ip)){
			return 0;
		}
		
		long[] addr = StringUtility.splitUInt32(ip, '.');

		long result = 0;

		if (addr.length == 4)
		{
			result |= (addr[0] << 24);
			result |= (addr[1] << 16);
			result |= (addr[2] << 8);
			result |= addr[3];
		}

		return result;
	}
	
	public static int[] convert(String[] ips)
	{
		int[] result=new int[ips.length];
		for(int i=0;i<result.length;i++){
			result[i]=convert(ips[i]);
		}
		return result;
	}

	/**
	 * 将无符号32位数转换成IP
	 * @param ipNum
	 * @return
	 */
	public static String convert(int ipNum)
	{
		StringBuilder ipBuilder = new StringBuilder();

		ipBuilder.append((ipNum & 0x000000FF));
		ipBuilder.append('.');
		ipBuilder.append((ipNum & 0x0000FFFF) >> 8);
		ipBuilder.append('.');
		ipBuilder.append((ipNum & 0x00FFFFFF) >> 16);
		ipBuilder.append('.');
		ipBuilder.append((ipNum >> 24) & 0xFF);

		return ipBuilder.toString();
	}
	
	public static String convert(long ipNum, OutParameter<Integer> port){
		port.value = (int) (ipNum & 0xffffffff);
		int ip = (int) ((ipNum >> 32) & 0xffffffff);
		return convert(ip);
	}

	/**
	 * 将bytes数组存储的IP地址转化为字符串
	 * @param bytes
	 * @return
	 */
	public static String convertFromBytes(byte[] bytes)
	{
		int result = convertIpToInt(bytes);

		return convert(result);
	}
	
	public static byte[] convertToBytes(String ip){
		long[] addr = StringUtility.splitUInt32(ip, '.');

		byte[] result = new byte[4];

		if (addr.length == 4)
		{
			result[0] = (byte)addr[0];
			result[1] = (byte)(addr[1]);
			result[2] = (byte)(addr[2]);
			result[3] = (byte)(addr[3]);
		}

		return result;
	}

	/**
	 * 将bytes数组存储的IP地址转化为整型
	 * @param bytes
	 * @return
	 */
	public static int convertIpToInt(byte[] bytes)
	{
		return ConvertUtility.toIntByLittleEdian(bytes);
	}
	
	/**
	 * 把以整形表示的ip地址转换为2进制表示的字符串。
	 * @param ipNum
	 * @return
	 */
	public static String toBinaryString(int ipNum){
		return StringUtility.toBinaryStringByLittleEdian(ipNum, '.');
	}
	
	/**
	 * 对服务端的ip做排序，使本机能与越近ip去连服务端
	 * @param serverIps 服务端的ip列表
	 * @return 下标越低的ip表示与本机越近
	 */
	public static String[] sortNearIps(String[] serverIps)
	{
		String[] localIps = getLocalIps();

		List<Tuple<Integer, String>> ipList=new ArrayList<Tuple<Integer,String>>();
		for (int i = 0; i < serverIps.length; i++)
		{
			int sip=convert(serverIps[i]);
			int sameCount = 0;
			for (int k = 0; k < localIps.length; k++)
			{
				int lip=convert(localIps[k]);
				int xor = sip ^ lip;
				xor = ConvertUtility.inverseBytesByLittleEndian(xor);
				int count=0;
				for (int n = 0; n < 32; n++)
				{
					if ((xor & 1) == 1) break;
					count++;
					xor = xor >> 1;
				}
				sameCount = Math.max(sameCount, count);
			}
			ipList.add(new Tuple<Integer, String>(sameCount, serverIps[i]));
		}

        ipList.sort((one,another) ->
        {
            return one.item1().compareTo(another.item1());
        });
        
        String[] result=new String[ipList.size()];
        for (int i = 0; i < result.length; i++)
        {
            result[i] = ipList.get(ipList.size() - i-1).item2();
        }
        return result;
	}
	
	public synchronized static String[] getLocalIps(){
		if(localIps != null && localIps.length > 0){
			return localIps;
		}
		
		List<Short> masklist = new ArrayList<Short>();
		List<String> broadlist = new ArrayList<String>();
		
		localIps = IPUtility.getLocalIpsInternal(masklist, broadlist);
		String[] bips = new String[broadlist.size()];
		broadlist.toArray(bips);
		
		Short[] netmasks = new Short[masklist.size()];
		masklist.toArray(netmasks);
		
		broadIps = bips;
		masks = netmasks;
		
		return localIps;
	}
	
	public static String[] getLocalBroadcastIps(){
		getLocalIps();
		return broadIps;
	}
	
	public static Short[] getSubnetMasks(){
		getLocalIps();
		return masks;
	}
	
	public static long[] getLocalLongIps(){
		String[] ips = getLocalIps();
		long[] res = new long[ips.length];
		for(int i=0; i<res.length; i++){
			String ip = ips[i];
			res[i] = convertToLong(ip);
		}
		return res;
	}
	
	public static int[] getLocalIntIps(){
		String[] ips = getLocalIps();
		int[] res = new int[ips.length];
		for(int i=0; i<res.length; i++){
			String ip = ips[i];
			res[i] = convert(ip);
		}
		return res;
	}
	
	public static long[] getLocalLongIps(int port){
		String[] ips = getLocalIps();
		long[] res = new long[ips.length];
		for(int i=0; i<res.length; i++){
			String ip = ips[i];
			long v = convertToLong(ip);
			v = (v << 32) | (0xffff & port);
			res[i] = v;
		}
		return res;
	}
	
	public static String getLocalIp(String externalIp){
		String res = null;
		String[] ips = getLocalIps();
		for(String ip : ips){
			if(!StringUtility.isNullOrEmpty(externalIp) && ip.equals(externalIp)){
				continue;
			}
			res = ip;
		}
		if(StringUtility.isNullOrEmpty(res)){
			res = "127.0.0.1";
		}
		return res;
	}

	/**
	 * 获得本地的所有ip
	 * @return
	 */
	private static String[] getLocalIpsInternal(List<Short> masklist, List<String> broadlist){
		List<String> res = new ArrayList<String>();
		try{
			Enumeration<NetworkInterface> allNetInterfaces = NetworkInterface.getNetworkInterfaces();
			InetAddress ip = null;
			InetAddress broadip = null;
			while (allNetInterfaces.hasMoreElements()){
				NetworkInterface netInterface = (NetworkInterface) allNetInterfaces.nextElement();
				if(netInterface.isLoopback() || netInterface.isVirtual()){
					continue;
				}
				List<InterfaceAddress> addrlist = netInterface.getInterfaceAddresses();
				for(InterfaceAddress addr : addrlist){
					short masklen = addr.getNetworkPrefixLength();
					ip = addr.getAddress();
					broadip = addr.getBroadcast();
					if (ip != null && ip instanceof Inet4Address){
						String ipstr = ip.getHostAddress();
						if(!ipstr.contains("127.0.0.1")){
							res.add(ipstr);
							masklist.add(masklen);
							broadlist.add(broadip.getHostAddress());
						}
					} 
				}
			} 
		}catch(Exception e){
			e.printStackTrace();
		}
		
		res.sort((one, another)->{
			long n1 = convertToLongReverse(one);
			long n2 = convertToLongReverse(another);
			Long num1 = new Long(n1);
			Long num2 = new Long(n2);
			return num1.compareTo(num2);
		});
		
		localIps = new String[res.size()];
		res.toArray(localIps);
		return localIps;					
	}
	
	/**
	 * 获得本机与目标IP在同个网络的IP地址
	 * @param destIp
	 * @return
	 */
	public static String getSameAreaIp(String destIp){
		return getSameAreaIp(destIp,getLocalIps());
	}
	
	/**
	 * 获得本机与目标IP在同个网络的IP地址
	 * @param destIp 目标IP
	 * @param localIps 本机网络地址
	 * @return
	 */
	public static String getSameAreaIp(String destIp,String[] localIps){
		int[] localByteIps=new int[localIps.length];
		for(int i=0;i<localIps.length;i++){
			localByteIps[i]=convert(localIps[i]);
		}
		return getSameAreaIp(destIp,localByteIps,localIps);
	}
	
	/**
	 *  获得本机与目标IP在同个网络的IP地址
	 * @param destIp 目标IP
	 * @param localByteIps 本机网络二进制表示的地址
	 * @return
	 */
	public static String getSameAreaIp(String destIp,int[] localByteIps,String[] localIps){
		if (destIp==null || "".equals(destIp)) return null;
		
		int destByteIp=convert(destIp);
		int destC=destByteIp & 0x00FFFFFF;
		int destB=destByteIp & 0x0000FFFF;
		int destA=destByteIp & 0x000000FF;
		
		int[] localCs=new int[localByteIps.length];
		int[] localBs=new int[localByteIps.length];
		int[] localAs=new int[localByteIps.length];
		for(int i=0;i<localByteIps.length;i++){
			int byteIp=localByteIps[i];
			localCs[i]=byteIp & 0x00FFFFFF;
			localBs[i]=byteIp & 0x0000FFFF;
			localAs[i]=byteIp & 0x000000FF;
		}
		
		/**
		 * 比较规则：依此比较是否在同个C、B、A类网络里
		 */
		for (KeyValuePair<Integer,int[]> item : new KeyValuePair[]{
				new KeyValuePair<Integer,int[]>(destC,localCs),
				new KeyValuePair<Integer,int[]>(destB,localBs),
				new KeyValuePair<Integer,int[]>(destA,localAs)
		}){
			int dest=item.getKey();
			int[] array=item.getValue();
			for(int i=0;i<array.length;i++){
				if (dest==array[i]) return localIps[i];
			}
		}
		
		return null;
	}
	
	
	public static IpAreaInfo getIpAreaInfo(String ip){
    	KeyValuePair<String, String> param = new KeyValuePair<String, String>("ip", ip);
    	KeyValuePair<String, String>[] params = new KeyValuePair[]{ param };
    	String res = HttpClientUtility.getString("http://ip.taobao.com/service/getIpInfo.php", params);
    	Map<String, Object> json = JsonUtility.toDictionary(res);
    	int code = ConvertUtility.getValueAsInt(json.get("code"));
    	if(code != 0){
    		return null;
    	}
    	
    	Map data = (Map) json.get("data");
    	IpAreaInfo info = new IpAreaInfo();
    	
    	info.country = (String) data.get("country");
    	info.countryCode = (String) data.get("country_id");
    	info.area = (String) data.get("area");
    	info.areaCode = (String) data.get("area_id");
    	info.province = (String) data.get("region");
    	info.provinceCode = (String) data.get("region_id");
    	info.city = (String) data.get("city");
    	info.cityCode = (String) data.get("city_id");
    	info.isp = (String) data.get("isp");
    	info.ispCode = (String) data.get("isp_id");
    	
    	return info;
	}
	
	public static class IpAreaInfo {
		public String country;
		public String area;
		public String areaCode;
		public String province;
		public String city;
		public String countryCode;
		public String provinceCode;
		public String cityCode;
		public String isp;
		public String ispCode;
		
		public String toString(){
			return JsonUtility.encode(this);
		}
	}
	
	
	public static void printReachableIP(String remoteIp, int port){ 
		String retIP = null;
        Enumeration<NetworkInterface> netInterfaces; 
        try{ 
        	netInterfaces =	NetworkInterface.getNetworkInterfaces(); 
        	while(netInterfaces.hasMoreElements()) {
	            NetworkInterface ni = netInterfaces.nextElement();
	            Enumeration<InetAddress> localAddrs = ni.getInetAddresses();
	            while(localAddrs.hasMoreElements()){ 
	            	InetAddress localAddr =	localAddrs.nextElement(); 
	            	if(isReachable(localAddr.getHostAddress(), remoteIp, port, 5000)){ 
	            		retIP = localAddr.getHostAddress(); 
	            		break; 
	            	} 
	            } 
            } 
        } catch(SocketException e) {
            System.out.println( "Error occurred while listing all the local network addresses."); 
        } 
        if(retIP == null){ 
        	System.out.println("NULL reachable local IP is found!"); 
        }else{ 
        	System.out.println("Reachable local IP is found, it is " + retIP);
        } 
	} 
	
	public static boolean isReachable(String localIp, String remoteIp, int port, int timeout) { 
		boolean isReachable = false; 
		Socket socket = null; 
		try{ 
			if(remoteIp.trim().equals("127.0.0.1")){
				localIp = "127.0.0.1";
			}
			InetAddress localInetAddr = InetAddress.getByName(localIp);
			InetAddress remoteInetAddr = InetAddress.getByName(remoteIp);
			socket = new Socket(); 
			// 端口号设置为 0 表示在本地挑选一个可用端口进行连接 
			SocketAddress localSocketAddr = new InetSocketAddress(localInetAddr, 0); 
            socket.bind(localSocketAddr); 
            InetSocketAddress endpointSocketAddr = new InetSocketAddress(remoteInetAddr, port);
            socket.connect(endpointSocketAddr, timeout); 
            isReachable = true; 
        } catch(Exception e) { 
        	QueueLog.error(AppLoggers.ErrorLogger, "FAIL - CAN not connect! Local:{}, remote: {}:{} ", localIp, remoteIp, port);
        } finally{ 
        	if(socket != null) { 
        		try{ 
        			socket.close(); 
        		} catch(Exception e) { 
        			QueueLog.error(AppLoggers.ErrorLogger, "Error occurred while closing socket..");
        		} 
        	} 
        } 
		return isReachable; 
    }
	
	public static boolean isReachable(String localIp, String remoteIp, int port){
		return isReachable(localIp, remoteIp, port, 1000);
	}
	
	public static boolean isReachable(String remoteIp, int port){
		return isReachable(remoteIp, port, 1000);
	}
	
	public static boolean isReachable(String remoteIp, int port, int timeout){
		String[] ips = IPUtility.getLocalIps();
		for(String ip : ips) {
			boolean flag = isReachable(ip, remoteIp, port, timeout);
			if(flag) {
				return true;
			}
		}
		return false;
	}
	
	public static boolean isReachable(long serveripnum){
		OutParameter<Integer> port = new OutParameter<Integer>();
		port.value = 0;
		String ip = IPUtility.convert(serveripnum, port);
		if(port.value<=0 || port.value >= 65535 || !isReachable(ip, port.value, 500)){
			return false;
		}
		return true;
	}
	
	public static String getIpByName(String dn){
		try {
			InetAddress add = InetAddress.getByName(dn);
			return add.getHostAddress();
		} catch (UnknownHostException e) {
			e.printStackTrace();
			return null;
		}
	}
		
	public static String getExternalIp(String externalIpProviderUrl){
		String html = HttpClientUtility.getString(externalIpProviderUrl);
		
		Pattern pattern=Pattern.compile("(\\d{1,3})[.](\\d{1,3})[.](\\d{1,3})[.](\\d{1,3})", Pattern.CASE_INSENSITIVE);      
        Matcher matcher=pattern.matcher(html);          
        while(matcher.find()){  
            return matcher.group(0);  
        }
        
		return "";
	}
	
	public static String getHttpRemoteIp(HttpServletRequest request){
		String ip = request.getHeader("x-forwarded-for");
		if(ip == null || ip.length() == 0 || "unknown".equalsIgnoreCase(ip)) {
			ip = request.getHeader("Proxy-Client-IP");
		}
		if(ip == null || ip.length() == 0 || "unknown".equalsIgnoreCase(ip)) {
			ip = request.getHeader("WL-Proxy-Client-IP");
		}
		if(ip == null || ip.length() == 0 || "unknown".equalsIgnoreCase(ip)) {
			ip = request.getRemoteAddr();
		}
		return ip;
	}
	
	public static List<Tuple<String, Integer>> getServerIpPorts(){
		try{
			MBeanServer beanServer = ManagementFactory.getPlatformMBeanServer();
			Set<ObjectName> objectNames = beanServer.queryNames(new ObjectName("*:type=Connector,*"),
	                Query.match(Query.attr("protocol"), Query.value("HTTP/1.1")));
			List<Tuple<String, Integer>> list = new ArrayList<Tuple<String, Integer>>();
			for(ObjectName objn : objectNames){
				String p = objn.getKeyProperty("port");
				int port = ConvertUtility.getValueAsInt(p);
				for(String ip : IPUtility.getLocalIps()){
					if(isReachable(ip, port)){
						list.add(new Tuple<String, Integer>(ip, port));
					}
				}
			}
			
			return list;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static Tuple<String, Integer> getServerIpPort(){
		List<Tuple<String, Integer>> list = getServerIpPorts();
		if(list.isEmpty()) {
			return null;
		}
		return list.get(0);
	}
	
	public static String[] getLocalMac(){
		List<String> res = new ArrayList<String>();
		try{
			Enumeration<NetworkInterface> allNetInterfaces = NetworkInterface.getNetworkInterfaces();
			while (allNetInterfaces.hasMoreElements()){
				NetworkInterface netInterface = (NetworkInterface) allNetInterfaces.nextElement();
				if(netInterface.isLoopback() || netInterface.isVirtual()){
					continue;
				}
				byte[] macraw = netInterface.getHardwareAddress();
				if(macraw == null){
					continue;
				}
				String mac = ByteUtility.toHexString(macraw);
				res.add(mac);
			} 
		}catch(Exception e){
			e.printStackTrace();
		}
		
		String[] ary = new String[res.size()];
		return res.toArray(ary);
	}
	
	public static String getHostName() {
		try {
			return InetAddress.getLocalHost().getHostName();			
		}catch(Exception e) {
			throw new RuntimeException();
		}
	}
	
	public static void main(String[] args){
		String[] ips = getLocalIps();
		System.out.println(ConvertUtility.getValueAsString(ips));
//		String provider = "http://ip.51240.com";
//		String externalip = getExternalIp(provider);
//		System.out.println(externalip);
		
		System.out.println(ConvertUtility.getValueAsString(broadIps));
		System.out.println(ConvertUtility.getValueAsString(masks));
		
		String[] macs = getLocalMac();
		System.out.println(ConvertUtility.getValueAsString(macs));
		
		List<Tuple<String, Integer>> srvport = getServerIpPorts();
		System.out.println(ConvertUtility.getValueAsString(srvport));
	}
	
}
