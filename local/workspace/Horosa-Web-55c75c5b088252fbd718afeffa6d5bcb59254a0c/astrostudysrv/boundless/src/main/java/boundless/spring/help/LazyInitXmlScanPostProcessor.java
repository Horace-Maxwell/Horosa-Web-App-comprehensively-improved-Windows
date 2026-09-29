package boundless.spring.help;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.springframework.beans.BeansException;
import org.springframework.beans.factory.Aware;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.FactoryBean;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.context.ApplicationListener;
import org.springframework.context.Lifecycle;
import org.springframework.context.annotation.ScannedGenericBeanDefinition;
import org.springframework.core.Ordered;
import org.springframework.util.ClassUtils;

/**
 * 延迟初始化补全:让 XML {@code <context:component-scan>} 扫出的 bean 也遵守 {@code spring.main.lazy-initialization}。
 *
 * 病根:XML 命名空间解析器给扫描器套用 {@code <beans>} 的 default-lazy-init 缺省(false)时写成<b>显式</b>
 * lazyInit=false;Spring Boot 的 LazyInitializationBeanFactoryPostProcessor 只补「未显式设置(null)」的定义,
 * 于是注解扫描的 bean 全部延迟、XML 扫描的控制器 / 服务却仍在启动期逐个实例化(启动关键路径上白付实例化成本)。
 *
 * 本处理器只把「ScannedGenericBeanDefinition 且显式 lazyInit=false」并且<b>没有任何启动 / 停机钩子</b>的定义翻为
 * lazy:实现 Aware / ApplicationListener / Lifecycle / SmartInitializingSingleton / InitializingBean / DisposableBean /
 * FactoryBean / BeanPostProcessor / BeanFactoryPostProcessor,或带 @PostConstruct / @PreDestroy / @EventListener /
 * @Scheduled / @Bean 方法,或类上显式 @Lazy / @Configuration 的一律不动(语义原样)。
 *
 * 只在 spring.main.lazy-initialization=true 时生效(与 Boot 语义同源);{@code -Dhorosa.lazyinit.xmlscan=false}
 * 或环境变量 {@code HOROSA_JAVA_XML_SCAN_LAZY=0} 整体回旧。翻过的 bean 名记录在 {@link #flipped()},启动就绪后
 * 由自热身线程在后台预实例化,首个真实请求不付实例化成本。
 */
public class LazyInitXmlScanPostProcessor implements BeanFactoryPostProcessor, Ordered {

	private static final List<String> FLIPPED = new CopyOnWriteArrayList<>();

	private static final List<Class<?>> HOOK_TYPES = Arrays.asList(
			Aware.class, ApplicationListener.class, Lifecycle.class, SmartInitializingSingleton.class,
			InitializingBean.class, DisposableBean.class, FactoryBean.class, BeanPostProcessor.class,
			BeanFactoryPostProcessor.class);

	private static final List<String> HOOK_METHOD_ANNOTATIONS = Arrays.asList(
			"javax.annotation.PostConstruct", "javax.annotation.PreDestroy",
			"jakarta.annotation.PostConstruct", "jakarta.annotation.PreDestroy",
			"org.springframework.context.event.EventListener",
			"org.springframework.scheduling.annotation.Scheduled", "org.springframework.scheduling.annotation.Schedules",
			"org.springframework.context.annotation.Bean");

	private static final List<String> HOOK_TYPE_ANNOTATIONS = Arrays.asList(
			"org.springframework.context.annotation.Lazy", "org.springframework.context.annotation.Configuration");

	private final boolean lazyInitEnabled;

	public LazyInitXmlScanPostProcessor(boolean lazyInitEnabled) {
		this.lazyInitEnabled = lazyInitEnabled;
	}

	/** 翻为 lazy 的 bean 名(启动顺序);只读。 */
	public static List<String> flipped() {
		return Collections.unmodifiableList(new ArrayList<>(FLIPPED));
	}

	/** 开关:系统属性 horosa.lazyinit.xmlscan(缺省 true)优先,其次环境变量 HOROSA_JAVA_XML_SCAN_LAZY(0/false 关)。 */
	public static boolean switchOn() {
		String prop = System.getProperty("horosa.lazyinit.xmlscan");
		if (prop != null && !prop.trim().isEmpty()) {
			return !("false".equalsIgnoreCase(prop.trim()) || "0".equals(prop.trim()));
		}
		String env = System.getenv("HOROSA_JAVA_XML_SCAN_LAZY");
		if (env != null && !env.trim().isEmpty()) {
			return !("false".equalsIgnoreCase(env.trim()) || "0".equals(env.trim()));
		}
		return true;
	}

	@Override
	public int getOrder() {
		return Ordered.LOWEST_PRECEDENCE;
	}

	@Override
	public void postProcessBeanFactory(ConfigurableListableBeanFactory beanFactory) throws BeansException {
		if (!lazyInitEnabled || !switchOn()) {
			return;
		}
		ClassLoader loader = beanFactory.getBeanClassLoader();
		for (String name : beanFactory.getBeanDefinitionNames()) {
			BeanDefinition bd = beanFactory.getBeanDefinition(name);
			if (!(bd instanceof ScannedGenericBeanDefinition)) {
				continue;
			}
			ScannedGenericBeanDefinition sbd = (ScannedGenericBeanDefinition) bd;
			Boolean lazy = sbd.getLazyInit();
			if (lazy == null || lazy) {
				continue;   // null = Boot 自己会补;true = 已延迟
			}
			Class<?> type = loadType(sbd, loader);
			if (type == null || !eligible(type)) {
				continue;
			}
			sbd.setLazyInit(true);
			FLIPPED.add(name);
		}
	}

	private static Class<?> loadType(ScannedGenericBeanDefinition sbd, ClassLoader loader) {
		try {
			if (sbd.hasBeanClass()) {
				return sbd.getBeanClass();
			}
			String cn = sbd.getBeanClassName();
			return cn == null ? null : ClassUtils.forName(cn, loader);
		} catch (Throwable t) {
			return null;
		}
	}

	/** 无任何启动 / 停机钩子 = 可以安全延迟(纯按类型与注解机械判定;拿不准一律 false)。 */
	public static boolean eligible(Class<?> type) {
		try {
			for (Class<?> hook : HOOK_TYPES) {
				if (hook.isAssignableFrom(type)) {
					return false;
				}
			}
			for (Annotation a : type.getAnnotations()) {
				if (HOOK_TYPE_ANNOTATIONS.contains(a.annotationType().getName())) {
					return false;
				}
			}
			for (Class<?> c = type; c != null && c != Object.class; c = c.getSuperclass()) {
				for (Method m : c.getDeclaredMethods()) {
					for (Annotation a : m.getAnnotations()) {
						if (HOOK_METHOD_ANNOTATIONS.contains(a.annotationType().getName())) {
							return false;
						}
					}
				}
			}
			return true;
		} catch (Throwable t) {
			return false;
		}
	}
}
