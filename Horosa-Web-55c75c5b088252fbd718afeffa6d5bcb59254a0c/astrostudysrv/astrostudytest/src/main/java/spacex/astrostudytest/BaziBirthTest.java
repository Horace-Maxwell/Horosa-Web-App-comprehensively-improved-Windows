package spacex.astrostudytest;

import java.util.HashMap;
import java.util.Map;

import boundless.io.FileUtility;

public class BaziBirthTest {

	private static String url = "http://zyqspace.7766.org:9999";

	public static void main(String[] args) {
//		url = "http://127.0.0.1:9999";
		HttpClientTest test = new HttpClientTest();

		Map<String, Object> params = new HashMap<String, Object>();
		params.put("date", "1976-07-06");
		params.put("time", "21:11:00");
		params.put("zone", "+08:00");
		params.put("lat", "26n06");
		params.put("lon", "119e18");
		params.put("maodelta", 180);
		params.put("gender", 1);
		String json = test.post(url + "/bazi/direct", params);
		
		FileUtility.save("/Users/zjf/file/aaa/bazi.json", json);
		System.out.println(json);

	}

}
