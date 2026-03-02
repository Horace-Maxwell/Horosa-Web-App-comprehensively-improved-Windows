package boundless.console;

import java.io.BufferedReader;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.StringTokenizer;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.utility.ConvertUtility;
import boundless.utility.ProcessUtility;

public class OSXInfo {

	public static Map<?, ?> cpuinfo() {
        Map<String, Object> map = new HashMap<String, Object>();
        try {
        	String prefix = "CPU usage: ";
        	int prefixlen = prefix.length();
        	ProcessUtility.execute("top -l 1 -n 1", null, (list)->{
        		for(String line : list){
        			if(line.startsWith(prefix)){
        				String cpustr = line.substring(prefixlen);
        				StringTokenizer tokenizer = new StringTokenizer(cpustr);
        				List<String> temp = new ArrayList<String>();
                        while (tokenizer.hasMoreElements()) {
                            String value = tokenizer.nextToken();
                            temp.add(value);
                        }
                        String user = temp.get(0);
                        String sys = temp.get(2);
                        String idle = temp.get(4);
                        map.put("user", user.substring(0, user.length()-1));
                        map.put("sys", sys.substring(0, sys.length()-1));
                        map.put("idle", idle.substring(0, idle.length()-1));
                        break;
        			}
        		}
        	});
        } catch (Exception e) {
        	QueueLog.error(AppLoggers.ErrorLogger, e);
        } 

        return map;
    }

	public static int cpuUsage() {
        try {
            Map<?, ?> map = cpuinfo();
            float idle = 100 - ConvertUtility.getValueAsFloat(map.get("idle"));
            idle = Math.round(idle);
            
            
            return ConvertUtility.getValueAsInt(idle);
        } catch (Exception e) {
            QueueLog.error(AppLoggers.ErrorLogger, e);
        }
        return 0;
    }
	
	
	
	public static void main(String[] args){
		int usage = cpuUsage();
		System.out.println(usage);
	}
	
}
