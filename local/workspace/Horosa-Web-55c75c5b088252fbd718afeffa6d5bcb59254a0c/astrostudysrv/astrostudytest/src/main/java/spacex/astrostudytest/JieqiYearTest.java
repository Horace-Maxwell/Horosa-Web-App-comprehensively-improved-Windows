package spacex.astrostudytest;

import java.util.HashMap;
import java.util.Map;

public class JieqiYearTest {

	private static String url = "http://spacex.f3322.net:9999";

	public static void main(String[] args) {
//		url = "http://123.206.188.220:9999";
		HttpClientTest test = new HttpClientTest();

		Map<String, Object> params = new HashMap<String, Object>();
		params.put("year", "2019");
		params.put("zone", "+08:00");
		params.put("lat", "26n06");
		params.put("lon", "119e18");
		params.put("jieqis", new String[] {"春分"});
		String json = test.post(url + "/jieqi/year", params);
		System.out.println(json);

	}

}
