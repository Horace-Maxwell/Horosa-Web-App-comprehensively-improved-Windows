package boundless.console;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.StringReader;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.RuntimeMXBean;
import java.lang.management.ThreadMXBean;
import java.nio.file.FileStore;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Properties;

import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.security.MD5Utility;
import boundless.utility.ConvertUtility;
import boundless.utility.IPUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;
import oshi.SystemInfo;
import oshi.hardware.CentralProcessor;
import oshi.hardware.ComputerSystem;
import oshi.hardware.HardwareAbstractionLayer;
import oshi.software.os.OperatingSystem;

public class Diagnostic {
	public static final String TotalMemoryKey = "TotalMemory";
	public static final String FreeMemoryKey = "FreeMemory";
	public static final String MaxMemoryKey = "MaxMemory";
	public static final String HeapMemoryKey = "HeapMemory";
	public static final String NonHeapMemoryKey = "NonHeapMemory";
	public static final String ThreadCountKey = "ThreadCount";
	public static final String CurrentThreadCpuTimeKey = "CurrentThreadCpuTime";
	public static final String ProcessIdKey = "ProcessId";
	public static final String CpuUsageKey = "CpuUsage";
	public static final String MemoryUsageKey = "MemoryUsage";
	
	public static Map<String, Long> getSystemState(){
		Runtime rt = Runtime.getRuntime();
		Map<String, Long> map = new HashMap<String, Long>();
		map.put(TotalMemoryKey, rt.totalMemory());
		map.put(FreeMemoryKey, rt.freeMemory());
		map.put(MaxMemoryKey, rt.maxMemory());
		
		MemoryMXBean mm = ManagementFactory.getMemoryMXBean();
		map.put(HeapMemoryKey, mm.getHeapMemoryUsage().getUsed());
		map.put(NonHeapMemoryKey, mm.getNonHeapMemoryUsage().getUsed());
		
		ThreadMXBean tm = ManagementFactory.getThreadMXBean();
		map.put(ThreadCountKey, (long)tm.getThreadCount());
		map.put(CurrentThreadCpuTimeKey, tm.getCurrentThreadCpuTime());
		
		RuntimeMXBean rm = ManagementFactory.getRuntimeMXBean();
		String nparts[] = rm.getName().split("@");
		try{
    		long procid = ConvertUtility.getValueAsLong(nparts[0]);
    		map.put(ProcessIdKey, procid);
		}catch(Exception err){
			map.put(ProcessIdKey, (long)-1);
		}
		
		if(OSinfo.isLinux()){
			map.put(CpuUsageKey, ConvertUtility.getValueAsLong(LinuxInfo.cpuUsage()));
			map.put(MemoryUsageKey, ConvertUtility.getValueAsLong(LinuxInfo.memoryUsage()));
		}else if(OSinfo.isMacOSX() || OSinfo.isMacOS()){
			map.put(CpuUsageKey, ConvertUtility.getValueAsLong(OSXInfo.cpuUsage()));
		}
		
		map.put("GeneratedTime", System.currentTimeMillis());

		return map;
	}
	
	public static int getCpuUsage(){
		if(OSinfo.isLinux()){
			return LinuxInfo.cpuUsage();
		}else if(OSinfo.isMacOSX() || OSinfo.isMacOS()){
			return OSXInfo.cpuUsage();
		}
		
		return -1;
	}
	
	public static int getMemoryUsage(){
		if(OSinfo.isLinux()){
			return LinuxInfo.memoryUsage();
		}
		return -1;
	}
	
	public static int getThreadCount(){
		ThreadMXBean tm = ManagementFactory.getThreadMXBean();
		return tm.getThreadCount();
	}
	
	public static int getProcessId(){
		Map<String, Long> map = getSystemState();
		int pid = ConvertUtility.getValueAsInt(map.get(ProcessIdKey));
		return pid;
	}
	
	public static List<ProcessInfo> getProcessList(){
		List<ProcessInfo> list = new LinkedList<ProcessInfo>();
		try {
		    String line;
		    Process p = Runtime.getRuntime().exec("ps -e");
		    BufferedReader input =
		            new BufferedReader(new InputStreamReader(p.getInputStream()));
		    boolean firstline = true;
		    while ((line = input.readLine()) != null) {
		    	if(firstline){
		    		firstline = false;
		    		continue;
		    		
		    	}
//		        System.out.println(line); //<-- Parse data here.
		        String[] parts = line.trim().split("\\s+");
		        ProcessInfo proc = new ProcessInfo();
		        proc.pid = parts[0];
		        proc.cmd = parts[3];
		        
		        StringBuilder sb = new StringBuilder();
		        for(int i=4; i<parts.length; i++){
		        	sb.append(parts[i]).append(" ");
		        }
		        proc.args = sb.toString();
		        
		        list.add(proc);
		    }
		    input.close();
		    return list;
		} catch (Exception err) {
		    throw new RuntimeException(err);
		}
	}
	
	public static ProcessInfo findProcess(String onlycmd){
		try {
		    String line;
		    Process p = Runtime.getRuntime().exec("ps -e");
		    BufferedReader input =
		            new BufferedReader(new InputStreamReader(p.getInputStream()));
		    boolean firstline = true;
		    while ((line = input.readLine()) != null) {
		    	if(firstline){
		    		firstline = false;
		    		continue;
		    		
		    	}
		        String[] parts = line.trim().split("\\s+");
		        
		        if(parts[3].contains(onlycmd)){
			        ProcessInfo proc = new ProcessInfo();
			        proc.pid = parts[0];
			        proc.cmd = parts[3];
			        StringBuilder sb = new StringBuilder();
			        for(int i=4; i<parts.length; i++){
			        	sb.append(parts[i]).append(" ");
			        }
			        proc.args = sb.toString();
			        return proc;
		        }
		    }
		    input.close();
		    return null;
		} catch (Exception err) {
		    throw new RuntimeException(err);
		}
	}
	
	public static ProcessInfo findProcess(int pid){
		try {
		    String line;
		    Process p = Runtime.getRuntime().exec("ps -e");
		    BufferedReader input =
		            new BufferedReader(new InputStreamReader(p.getInputStream()));
		    boolean firstline = true;
		    while ((line = input.readLine()) != null) {
		    	if(firstline){
		    		firstline = false;
		    		continue;
		    		
		    	}
		        String[] parts = line.trim().split("\\s+");
		        int tmpid = ConvertUtility.getValueAsInt(parts[0]);
		        if(tmpid == pid){
			        ProcessInfo proc = new ProcessInfo();
			        proc.pid = parts[0];
			        proc.cmd = parts[3];
			        StringBuilder sb = new StringBuilder();
			        for(int i=4; i<parts.length; i++){
			        	sb.append(parts[i]).append(" ");
			        }
			        proc.args = sb.toString();
			        return proc;
		        }
		    }
		    input.close();
		    return null;
		} catch (Exception err) {
		    throw new RuntimeException(err);
		}
	}
	
	public static Map<String, DiskInfo> getDiskSpace(){
		Map<String, DiskInfo> map = new HashMap<String, DiskInfo>();
		for (Path root : FileSystems.getDefault().getRootDirectories()){
			try{
				FileStore store = Files.getFileStore(root);
				DiskInfo disk = new DiskInfo();
				disk.root = root.toString();
				disk.available = store.getUsableSpace();
				disk.total = store.getTotalSpace();
				map.put(disk.root, disk);
			}catch(Exception e){
				QueueLog.error(AppLoggers.ErrorLogger, e);
			}
		}
		return map;
	}
	
    public static String getHostId(){
    	String[] macs = IPUtility.getLocalMac();
    	
        SystemInfo systemInfo = new SystemInfo();
        HardwareAbstractionLayer hardwareAbstractionLayer = systemInfo.getHardware();
        CentralProcessor centralProcessor = hardwareAbstractionLayer.getProcessor();
        ComputerSystem computerSystem = hardwareAbstractionLayer.getComputerSystem();

        String baseboardSN = computerSystem.getBaseboard().getSerialNumber();
        String processorId = centralProcessor.getProcessorID();
        
        String macstr = StringUtility.joinWithSeperator(",", (Object[])macs);
//        String hostid = String.format("%s-%s-%s", macstr, processorId, baseboardSN);
        String hostid = macstr;
        
        return hostid;
    }
    
    public static String getHostIdWithMD5(){
    	String hid = getHostId();
    	QueueLog.info(AppLoggers.InfoLogger, "hostid: {}", hid);
    	return MD5Utility.encryptAsString(hid);
    }
	
    public static String getMavenVersion(String groupId, String artifactId){
    	try{
        	String props = FileUtility.getStringFromClassPath(String.format("META-INF/maven/%s/%s/pom.properties", groupId, artifactId));
        	StringReader reader = new StringReader(props);
        	Properties p = new Properties();
        	p.load(reader);
    		return p.getProperty("version");
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}
    }
	
	
	public static class ProcessInfo{
		public String pid;
		public String cmd;
		public String args = "";
	}
	
	public static class DiskInfo{
		public String root;
		public long available;
		public long total;
	}
	
	public static void main(String[] args){
		Map<String, DiskInfo> map = getDiskSpace();
		System.out.println(JsonUtility.encode(map));
	}
	
}
