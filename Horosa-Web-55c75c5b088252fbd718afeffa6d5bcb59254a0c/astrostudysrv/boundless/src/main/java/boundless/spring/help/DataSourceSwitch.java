package boundless.spring.help;

import org.springframework.core.NamedThreadLocal;


public class DataSourceSwitch {
	private static NamedThreadLocal<String>  threadLocal = new NamedThreadLocal<String>("DataSourceSwitch");
	

	public static void setDataSourceType(String dataSourceType) {
		threadLocal.set(dataSourceType);
	}

	public static String getDataSourceType() {
		String ds = threadLocal.get();
		return ds;
	}

	public static void clearDataSourceType() {
		threadLocal.remove();
	}
	
}
