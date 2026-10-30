package spacex.astrostudy.interceptor;

import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.lang.reflect.Proxy;

import javax.servlet.DispatcherType;
import javax.servlet.ServletContext;
import javax.servlet.http.HttpServletRequest;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import boundless.exception.NeedLoginException;
import boundless.spring.help.interceptor.TransData;

// 拦截器链最后一道(登录权限):存活探针裸 GET /heartbeat 不带登录态放行,PUT 与别的路径照旧要登录。
// 前两道(验签 / 应用鉴权)见 boundless 的 HeartbeatProbeExemptTest;三道共用 RequestHeaderInterceptor.isHeartbeatProbe。
public class HeartbeatProbePermissionTest {

	private static HttpServletRequest request(String method, String uri){
		ServletContext ctx = (ServletContext) Proxy.newProxyInstance(
			HeartbeatProbePermissionTest.class.getClassLoader(),
			new Class[] { ServletContext.class },
			(proxy, m, args)->"getContextPath".equals(m.getName()) ? "" : null);
		return (HttpServletRequest) Proxy.newProxyInstance(
			HeartbeatProbePermissionTest.class.getClassLoader(),
			new Class[] { HttpServletRequest.class },
			(proxy, m, args)->{
				switch(m.getName()) {
					case "getMethod": return method;
					case "getRequestURI": return uri;
					case "getServletContext": return ctx;
					case "getDispatcherType": return DispatcherType.REQUEST;
					default: return null;
				}
			});
	}

	@Before
	@After
	public void clear(){
		TransData.clearThreadContext();   // 未登录:当前用户为空
	}

	@Test
	public void bareProbePassesOthersNeedLogin() throws Exception {
		PermissionInterceptor perm = new PermissionInterceptor();
		assertTrue(perm.preHandle(request("GET", "/heartbeat"), null, null));
		try {
			perm.preHandle(request("PUT", "/heartbeat"), null, null);
			fail("PUT /heartbeat 未登录应被拦下");
		}catch(NeedLoginException expected) {
			// need.login
		}
		try {
			perm.preHandle(request("GET", "/user/info"), null, null);
			fail("别的路径未登录应被拦下");
		}catch(NeedLoginException expected) {
			// need.login
		}
	}
}
