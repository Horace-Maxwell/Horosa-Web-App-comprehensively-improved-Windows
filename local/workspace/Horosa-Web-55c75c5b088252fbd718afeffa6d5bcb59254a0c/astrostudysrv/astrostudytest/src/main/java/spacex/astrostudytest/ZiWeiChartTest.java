package spacex.astrostudytest;

import java.util.HashMap;
import java.util.Map;

public class ZiWeiChartTest {
	private static String url = "http://spacex.f3322.net:9999";

	public static void main(String[] args) {
		url = "http://123.206.188.220:9999";
		HttpClientTest test = new HttpClientTest();

		Map<String, Object> params = new HashMap<String, Object>();
		params.put("date", "1985-02-13");
		params.put("time", "22:38");
		params.put("zone", "+08:00");
		params.put("lat", "26n06");
		params.put("lon", "119e18");
		params.put("gender", "0");
		String json = test.post(url + "/ziwei/birth", params);
		System.out.println(json);

	}


}
