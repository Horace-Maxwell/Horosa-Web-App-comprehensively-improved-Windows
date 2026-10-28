package boundless.spring.help.interceptor;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotSame;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import javax.servlet.http.HttpServletRequest;

import org.junit.After;
import org.junit.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** SseHelper.push:同一 id 复用同一个不设超时的 SseEmitter,并把当前请求标成 SSE(拦截器据此不写普通响应体)。 */
public class SseHelperTest {

	@After
	public void cleanup() {
		TransData.clearThreadContext();
	}

	/** 只实现属性读写的请求桩,其余方法返回缺省值。 */
	private static HttpServletRequest requestStub(Map<String, Object> attrs) {
		return (HttpServletRequest) Proxy.newProxyInstance(SseHelperTest.class.getClassLoader(), new Class<?>[] {HttpServletRequest.class},
			(proxy, method, args) -> {
				switch (method.getName()) {
					case "getAttribute":
						return attrs.get((String) args[0]);
					case "setAttribute":
						attrs.put((String) args[0], args[1]);
						return null;
					case "removeAttribute":
						attrs.remove((String) args[0]);
						return null;
					case "hashCode":
						return System.identityHashCode(proxy);
					case "equals":
						return proxy == args[0];
					default:
						Class<?> rt = method.getReturnType();
						if (rt == boolean.class) {
							return false;
						}
						if (rt == int.class || rt == long.class) {
							return rt == int.class ? (Object) 0 : (Object) 0L;
						}
						return null;
				}
			});
	}

	@Test
	public void sameIdReusesEmitterWithoutTimeout() {
		String id = UUID.randomUUID().toString();
		SseEmitter first = SseHelper.push(id);
		assertSame(first, SseHelper.push(id));
		assertNotSame(first, SseHelper.push(UUID.randomUUID().toString()));
		assertEquals(Long.valueOf(0L), first.getTimeout());
	}

	@Test
	public void pushMarksBoundRequestAsSse() {
		Map<String, Object> attrs = new HashMap<String, Object>();
		TransData.setRequestObject(requestStub(attrs), null);
		assertFalse(TransData.isSSE());
		SseHelper.push(UUID.randomUUID().toString());
		assertTrue(TransData.isSSE());
	}
}
