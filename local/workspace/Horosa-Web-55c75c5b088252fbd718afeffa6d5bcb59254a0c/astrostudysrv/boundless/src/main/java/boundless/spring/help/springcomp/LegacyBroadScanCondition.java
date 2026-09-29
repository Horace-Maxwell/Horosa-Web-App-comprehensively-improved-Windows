package boundless.spring.help.springcomp;

import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.core.type.AnnotatedTypeMetadata;

/**
 * 旧版通配组件扫描的回旧开关:系统属性 {@code horosa.scan.legacyBroad=true} 优先,
 * 其次环境变量 {@code HOROSA_JAVA_LEGACY_BROAD_SCAN=1};缺省不启用。
 */
public class LegacyBroadScanCondition implements Condition {

	public static boolean enabled() {
		String prop = System.getProperty("horosa.scan.legacyBroad");
		if (prop != null && !prop.trim().isEmpty()) {
			return "true".equalsIgnoreCase(prop.trim()) || "1".equals(prop.trim());
		}
		String env = System.getenv("HOROSA_JAVA_LEGACY_BROAD_SCAN");
		return env != null && ("1".equals(env.trim()) || "true".equalsIgnoreCase(env.trim()));
	}

	@Override
	public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
		return enabled();
	}
}
