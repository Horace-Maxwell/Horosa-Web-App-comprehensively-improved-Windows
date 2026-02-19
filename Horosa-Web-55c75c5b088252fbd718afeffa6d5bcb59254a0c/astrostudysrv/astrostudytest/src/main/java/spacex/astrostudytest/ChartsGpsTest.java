package spacex.astrostudytest;

import java.util.HashMap;
import java.util.Map;

import boundless.security.SecurityUtility;

public class ChartsGpsTest {
	private static String url = "http://spacex.f3322.net:9999";

	public static void main(String[] args) throws Exception {
		url = "http://www.horosa.com:9999";
		url = "http://127.0.0.1:9999";
		HttpClientTest test = new HttpClientTest();

		Map<String, Object> params = new HashMap<String, Object>();
		params.put("cid", "6daa72672ab9464d97dc395a219e0997");
		params.put("limit", 10);
		String json = test.post(url + "/statis/chartsgps", params);
		System.out.println(json);

	}


}
