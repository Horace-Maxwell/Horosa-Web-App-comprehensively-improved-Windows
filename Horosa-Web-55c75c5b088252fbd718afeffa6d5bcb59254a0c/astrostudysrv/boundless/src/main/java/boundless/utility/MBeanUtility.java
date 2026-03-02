package boundless.utility;

import java.lang.management.ManagementFactory;

import javax.management.MBeanServer;
import javax.management.ObjectName;

public class MBeanUtility {
	
	public static void registerMBean(Object mbean, String objectName){
    	try{
        	MBeanServer mbs = ManagementFactory.getPlatformMBeanServer();
        	ObjectName name = new ObjectName(objectName);
        	mbs.registerMBean(mbean, name);
    	}catch(Exception e){
    		System.out.println(e.getMessage());
    	}
		
	}
	
	public static void unregisterMBean(String objectName){
    	try{
        	MBeanServer mbs = ManagementFactory.getPlatformMBeanServer();
        	ObjectName name = new ObjectName(objectName);
        	mbs.unregisterMBean(name);
    	}catch(Exception e){
    		System.out.println(e.getMessage());
    	}		
	}
	
}
