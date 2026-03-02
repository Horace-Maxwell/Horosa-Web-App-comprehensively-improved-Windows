package spacex.astrostudytest;

import java.util.HashMap;
import java.util.Map;

import boundless.security.SecurityUtility;

public class MemoTest {
	private static String url = "http://spacex.f3322.net:9999";

	public static void main(String[] args) throws Exception {
		url = "http://127.0.0.1:9999";
		HttpClientTest test = new HttpClientTest();

		Map<String, Object> params = new HashMap<String, Object>();
		params.put("cid", "6daa72672ab9464d97dc395a219e0997");
		params.put("type", "0");
		String txt = "this is a test";
		txt = SecurityUtility.base64(txt.getBytes("UTF-8"));
		params.put("memo", txt);
		String json = test.post(url + "/user/charts/memo", params);
		System.out.println(json);

	}


}
