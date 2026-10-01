package spacex.astrostudy.helper;

import java.util.function.Function;

/**
 * 冷路径结果「JSON 往返归一成纯 Map」的回退开关(无静态依赖,可单测)。
 * <p>
 * 缺省开:{@code ParamHashCacheHelper} 把冷路径结果往返一次,让返回值与本地缓存都是纯 Map / 数字 / 字符串 / 集合,
 * 冷热两路形状相同,Enum / POJO 响应也能落盘。
 * <p>
 * {@code -Dparamhash.persistable=false} 回旧口:不做往返,Enum / POJO 响应像从前一样不落本地缓存、按 getter 形状返回。
 * 桌面(加密通道)下两种口径逐字节相同;只给 {@code rspencrypt=false} 的客户端要 getter 形状时用。
 * 每次读系统属性(运行期可改、测试可翻)。
 */
public final class ParamHashPersistPolicy {
	public static final String PROPERTY = "paramhash.persistable";

	private ParamHashPersistPolicy() {}

	public static boolean enabled() {
		return !"false".equalsIgnoreCase(System.getProperty(PROPERTY, "true"));
	}

	/** 开 → persistable.apply(value);关 → 原值原样(同一引用)。 */
	public static Object apply(Object value, Function<Object, Object> persistable) {
		if(!enabled() || persistable == null) {
			return value;
		}
		return persistable.apply(value);
	}
}
