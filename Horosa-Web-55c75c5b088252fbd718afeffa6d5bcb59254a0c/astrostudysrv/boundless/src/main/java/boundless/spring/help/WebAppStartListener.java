package boundless.spring.help;

import javax.servlet.ServletContextEvent;
import javax.servlet.ServletContextListener;

import boundless.utility.IPUtility;

public class WebAppStartListener implements ServletContextListener {
	private static String[] localIp = IPUtility.getLocalIps();


	@Override
	public void contextInitialized(ServletContextEvent sce) {
		System.out.println("contextInitialized");
	}

	@Override
	public void contextDestroyed(ServletContextEvent sce) {
		System.out.println("contextDestroyed");
	}

}
