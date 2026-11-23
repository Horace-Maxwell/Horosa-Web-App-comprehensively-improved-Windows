package spacex.astrostudy.helper;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotSame;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import java.util.HashMap;
import java.util.Map;

import org.junit.Test;

/**
 * 客户端钉住的「此刻」:请求头 → 发给排盘引擎的正文字段。
 * 带了合规的头:正文多出 clientNowMs(及可选的 clientNowOffsetMin),于是既转给了引擎,也进了结果缓存键;
 * 没带 / 不合规:参数表原样(同一个对象),引擎照旧读系统时钟 —— 桌面 App 与单例调用的行为不变。
 */
public class AstroHelperClientNowTest {

	private static Map<String, Object> params(){
		Map<String, Object> p = new HashMap<String, Object>();
		p.put("date", "1990/01/01");
		p.put("zone", "+08:00");
		return p;
	}

	@Test
	public void noHeaderLeavesParamsUntouched(){
		Map<String, Object> p = params();
		assertSame(p, AstroHelper.withClientNow(p, null, null));
		assertSame(p, AstroHelper.withClientNow(p, "", "480"));
		assertSame(p, AstroHelper.withClientNow(p, "   ", null));
	}

	@Test
	public void validHeaderGoesIntoTheBody(){
		Map<String, Object> p = params();
		Map<String, Object> out = AstroHelper.withClientNow(p, "1906516800000", "480");
		assertNotSame(p, out);
		assertFalse("原表不被改动", p.containsKey(AstroHelper.NOW_FIELD));
		assertEquals(Long.valueOf(1906516800000L), out.get(AstroHelper.NOW_FIELD));
		assertEquals(Integer.valueOf(480), out.get(AstroHelper.NOW_OFFSET_FIELD));
		assertEquals("1990/01/01", out.get("date"));
		assertEquals(4, out.size());
	}

	@Test
	public void offsetIsOptionalAndValidatedSeparately(){
		Map<String, Object> a = AstroHelper.withClientNow(params(), " 1906516800000 ", null);
		assertEquals(Long.valueOf(1906516800000L), a.get(AstroHelper.NOW_FIELD));
		assertFalse(a.containsKey(AstroHelper.NOW_OFFSET_FIELD));
		Map<String, Object> b = AstroHelper.withClientNow(params(), "1906516800000", "9999");
		assertTrue(b.containsKey(AstroHelper.NOW_FIELD));
		assertFalse("偏移出界:只丢偏移,时刻照带", b.containsKey(AstroHelper.NOW_OFFSET_FIELD));
		Map<String, Object> c = AstroHelper.withClientNow(params(), "0", "-330");
		assertEquals(Long.valueOf(0L), c.get(AstroHelper.NOW_FIELD));
		assertEquals(Integer.valueOf(-330), c.get(AstroHelper.NOW_OFFSET_FIELD));
	}

	@Test
	public void malformedHeaderIsIgnored(){
		Map<String, Object> p = params();
		String[] bad = { "now", "1.5e12", "1906516800000.5", "19065168000000000000", "-99999999999999999", "253402300799001", "0x10", "1 2" };
		for(String v : bad){
			assertSame("「" + v + "」不该被认", p, AstroHelper.withClientNow(p, v, "480"));
		}
		assertNull(AstroHelper.parseClientNowMs("abc"));
		assertNull(AstroHelper.parseClientNowOffsetMin("1081"));
		assertNull(AstroHelper.parseClientNowOffsetMin("8.5"));
		assertEquals(Integer.valueOf(1080), AstroHelper.parseClientNowOffsetMin("1080"));
	}

	@Test
	public void differentMomentsMakeDifferentBodies(){
		// 进了正文 = 进了结果缓存键:同一张盘、不同的「此刻」,参数表不相等,不会拿到对方的缓存结果
		Map<String, Object> a = AstroHelper.withClientNow(params(), "1906516800000", "480");
		Map<String, Object> b = AstroHelper.withClientNow(params(), "1906516860000", "480");
		assertFalse(a.equals(b));
		assertEquals(a, AstroHelper.withClientNow(params(), "1906516800000", "480"));
	}

	@Test
	public void bodyFieldAlreadyPresentIsNotOverwritten(){
		Map<String, Object> p = params();
		p.put(AstroHelper.NOW_FIELD, Long.valueOf(1L));
		assertSame(p, AstroHelper.withClientNow(p, "1906516800000", "480"));
	}
}
