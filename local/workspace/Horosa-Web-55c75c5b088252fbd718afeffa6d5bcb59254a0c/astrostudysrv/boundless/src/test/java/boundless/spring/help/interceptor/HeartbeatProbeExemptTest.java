package boundless.spring.help.interceptor;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.Map;

import javax.servlet.DispatcherType;
import javax.servlet.http.HttpServletRequest;

import org.junit.After;
import org.junit.Test;

import boundless.exception.ErrorCodeException;

// 存活探针 GET /heartbeat 免验签、免应用鉴权只认读类方法:写状态文件的 PUT / POST 仍要验签与鉴权。
// 两道拦截器各有一道门:只免了验签时,应用鉴权照样把裸 GET 拦成 500 access_deny(本测试第二段即为此而设)。
public class HeartbeatProbeExemptTest {

	private static HttpServletRequest withMethod(String m){
		return (HttpServletRequest) Proxy.newProxyInstance(
			HeartbeatProbeExemptTest.class.getClassLoader(),
			new Class[] { HttpServletRequest.class },
			(proxy, method, args)->{
				if("getMethod".equals(method.getName())) { return m; }
				if("getDispatcherType".equals(method.getName())) { return DispatcherType.REQUEST; }
				return null;
			});
	}

	// 与 RequestHeaderInterceptor 解析裸探针请求后相同:有交易码,无应用头
	private static void bareRequest(String transcode){
		Map<String, Object> head = new HashMap<String, Object>();
		head.put(KeyConstants.TransCode, transcode);
		TransData.setRequestData(head, new HashMap<String, Object>());
	}

	@After
	public void clear(){
		TransData.pureClearTransData();
	}

	@Test
	public void onlyReadMethodsAreProbes(){
		assertTrue(RequestHeaderInterceptor.isProbeMethod(withMethod("GET")));
		assertTrue(RequestHeaderInterceptor.isProbeMethod(withMethod("head")));
		assertTrue(RequestHeaderInterceptor.isProbeMethod(withMethod("OPTIONS")));
		assertFalse(RequestHeaderInterceptor.isProbeMethod(withMethod("PUT")));
		assertFalse(RequestHeaderInterceptor.isProbeMethod(withMethod("POST")));
		assertFalse(RequestHeaderInterceptor.isProbeMethod(null));
	}

	@Test
	public void appAuthLetsBareProbeThroughOnly() throws Exception {
		TransCodeAppAuthInterceptor auth = new TransCodeAppAuthInterceptor();
		bareRequest("/heartbeat");
		assertTrue(auth.preHandle(withMethod("GET"), null, null));
		bareRequest("/heartbeat");
		try {
			auth.preHandle(withMethod("PUT"), null, null);
			fail("PUT /heartbeat 不带应用头应被应用鉴权拦下");
		}catch(ErrorCodeException expected) {
			// access_deny
		}
		bareRequest("/chart");
		try {
			auth.preHandle(withMethod("GET"), null, null);
			fail("别的交易码不带应用头应被应用鉴权拦下");
		}catch(ErrorCodeException expected) {
			// access_deny
		}
	}
}
