package spacex.astrostudytest;

import java.util.HashMap;
import java.util.Map;

import boundless.security.SecurityUtility;

public class QryChartTest {
	private static String url = "http://spacex.f3322.net:9999";

	public static void main(String[] args) throws Exception {
		url = "http://www.horosa.com:9999";
		url = "http://127.0.0.1:9999";
		HttpClientTest test = new HttpClientTest();

		Map<String, Object> params = new HashMap<String, Object>();
		String id = "6daa72672ab9464d97dc395a219e0997";
		params.put("cid", id);
		params.put("hsys", 0);
		params.put("zodiacal", 0);
		String json = test.post(url + "/qry/chart", params);
		System.out.println(json);

	}


}
