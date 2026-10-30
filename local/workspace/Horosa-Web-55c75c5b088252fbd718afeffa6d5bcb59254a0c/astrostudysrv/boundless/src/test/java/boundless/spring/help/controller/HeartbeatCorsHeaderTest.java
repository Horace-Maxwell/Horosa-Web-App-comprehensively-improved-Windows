package boundless.spring.help.controller;

import static org.junit.Assert.assertEquals;

import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.junit.Test;

// 跨域头只写一份:全站 CORS 过滤器先写过时不再追加(两个 Access-Control-Allow-Origin = 浏览器判跨域失败);
// 没有过滤器时照旧由探针控制器补上。
public class HeartbeatCorsHeaderTest {

	private static HttpServletRequest withOrigin(String origin){
		return (HttpServletRequest) Proxy.newProxyInstance(
			HeartbeatCorsHeaderTest.class.getClassLoader(),
			new Class[] { HttpServletRequest.class },
			(proxy, m, args)->"getHeader".equals(m.getName()) && "Origin".equals(args[0]) ? origin : null);
	}

	private static HttpServletResponse recording(List<String> added, boolean filterAlreadyWrote){
		return (HttpServletResponse) Proxy.newProxyInstance(
			HeartbeatCorsHeaderTest.class.getClassLoader(),
			new Class[] { HttpServletResponse.class },
			(proxy, m, args)->{
				if("containsHeader".equals(m.getName())) {
					return filterAlreadyWrote ? Boolean.TRUE : Boolean.valueOf(added.stream().anyMatch((h)->h.startsWith(args[0] + ":")));
				}
				if("addHeader".equals(m.getName())) { added.add(args[0] + ":" + args[1]); }
				return null;
			});
	}

	@Test
	public void allowOriginWrittenOnce(){
		List<String> withFilter = new ArrayList<String>();
		HeartbeatController.crossdomain(withOrigin("http://localhost:8000"), recording(withFilter, true));
		assertEquals(0, withFilter.size());

		List<String> noFilter = new ArrayList<String>();
		HeartbeatController.crossdomain(withOrigin("http://localhost:8000"), recording(noFilter, false));
		assertEquals(1, noFilter.size());
		assertEquals("Access-Control-Allow-Origin:http://localhost:8000", noFilter.get(0));
	}
}
