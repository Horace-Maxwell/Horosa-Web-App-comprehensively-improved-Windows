package spacex.astrostudytest;

import java.util.HashMap;
import java.util.Map;

public class DoorTest {

	private static String url = "http://127.0.0.1:9999";

	public static void main(String[] args) {
//		url = "http://123.206.188.220:9999";
		HttpClientTest test = new HttpClientTest();

		Map<String, Object> params = new HashMap<String, Object>();
		params.put("LockAction", 1);
		String json = test.post(url + "/door/locktrigger", params);
		System.out.println(json);

	}

}
