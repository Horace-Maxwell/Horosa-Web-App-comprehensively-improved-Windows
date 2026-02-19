package spacex.astrostudytest;

import java.util.HashMap;
import java.util.Map;

public class HostIdTest {

	private static String url = "http://spacex.f3322.net:9999";

	public static void main(String[] args) {
		url = "http://123.206.188.220:9999";

		HttpClientTest test = new HttpClientTest();
		Map<String, Object> params = new HashMap<String, Object>();
		
		String json = test.post(url + "/common/hostid", params);
		System.out.println(json);

	}

}
