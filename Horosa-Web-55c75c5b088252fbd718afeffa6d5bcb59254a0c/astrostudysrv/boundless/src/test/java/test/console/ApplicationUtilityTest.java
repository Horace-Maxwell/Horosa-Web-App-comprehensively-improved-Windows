package test.console;

import java.util.concurrent.ConcurrentHashMap;

import boundless.console.ApplicationUtility;
import boundless.io.FileUtility;
import boundless.model.HierarchicalMap;

public class ApplicationUtilityTest {

	public static void main(String[] args) {
		String appPath = ApplicationUtility.getAppPath(ApplicationUtilityTest.class);
		ConcurrentHashMap<Integer, HierarchicalMap> map = ApplicationUtility.monitorPackets();
		for(Integer key : map.keySet()){
			HierarchicalMap value = map.get(key);
			String logdir = FileUtility.combinePath(appPath, "Log/ResNode", value.getAttributeAsString("id") + "_" + value.getAttributeAsString("name"));
	    	System.out.println(logdir);
		}
	}

}
