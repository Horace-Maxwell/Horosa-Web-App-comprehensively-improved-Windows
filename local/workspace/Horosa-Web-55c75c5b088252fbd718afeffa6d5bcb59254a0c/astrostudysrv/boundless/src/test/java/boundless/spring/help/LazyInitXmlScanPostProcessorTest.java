package boundless.spring.help;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import javax.annotation.PostConstruct;

import org.junit.Test;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.beans.factory.support.AbstractBeanDefinition;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.beans.factory.support.RootBeanDefinition;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextAware;
import org.springframework.context.annotation.Lazy;
import org.springframework.context.annotation.ScannedGenericBeanDefinition;
import org.springframework.context.event.EventListener;
import org.springframework.core.type.classreading.CachingMetadataReaderFactory;
import org.springframework.stereotype.Controller;

/**
 * [R5-S5] XML 扫描 bean 延迟初始化补全的机械钉:
 *  · 只翻「ScannedGenericBeanDefinition 且显式 lazyInit=false」的定义;显式 true / 未设置(null)/ 非扫描定义不动
 *  · 有启动 / 停机钩子(Aware / InitializingBean / @PostConstruct / @EventListener / 类上 @Lazy)的一律不动
 *  · lazy-initialization 未开 → 恒无操作
 */
public class LazyInitXmlScanPostProcessorTest {

	@Controller
	public static class PlainController {
		public String hello() { return "hi"; }
	}

	@Controller
	public static class AwareController implements ApplicationContextAware {
		@Override public void setApplicationContext(ApplicationContext ctx) { }
	}

	public static class InitBeanService implements InitializingBean {
		@Override public void afterPropertiesSet() { }
	}

	public static class PostConstructService {
		@PostConstruct public void init() { }
	}

	public static class EventListenerService {
		@EventListener public void on(Object ev) { }
	}

	public static class SubOfPostConstruct extends PostConstructService { }

	@Lazy(false)
	public static class ExplicitEagerService { }

	@Test
	public void eligibility_is_hook_free_only() {
		assertTrue(LazyInitXmlScanPostProcessor.eligible(PlainController.class));
		assertFalse(LazyInitXmlScanPostProcessor.eligible(AwareController.class));
		assertFalse(LazyInitXmlScanPostProcessor.eligible(InitBeanService.class));
		assertFalse(LazyInitXmlScanPostProcessor.eligible(PostConstructService.class));
		assertFalse(LazyInitXmlScanPostProcessor.eligible(EventListenerService.class));
		assertFalse("父类的 @PostConstruct 同样是钩子", LazyInitXmlScanPostProcessor.eligible(SubOfPostConstruct.class));
		assertFalse("类上显式 @Lazy(false) 尊重原意", LazyInitXmlScanPostProcessor.eligible(ExplicitEagerService.class));
	}

	private static ScannedGenericBeanDefinition scanned(Class<?> type, Boolean lazy) throws Exception {
		CachingMetadataReaderFactory f = new CachingMetadataReaderFactory();
		ScannedGenericBeanDefinition bd = new ScannedGenericBeanDefinition(f.getMetadataReader(type.getName()));
		bd.setBeanClass(type);
		if (lazy != null) {
			bd.setLazyInit(lazy);
		}
		return bd;
	}

	@Test
	public void flips_only_xml_explicit_false_and_hook_free() throws Exception {
		DefaultListableBeanFactory bf = new DefaultListableBeanFactory();
		bf.registerBeanDefinition("plain", scanned(PlainController.class, Boolean.FALSE));
		bf.registerBeanDefinition("aware", scanned(AwareController.class, Boolean.FALSE));
		bf.registerBeanDefinition("annoScanned", scanned(PlainController.class, null));     // 注解扫描:交给 Boot 自己补
		bf.registerBeanDefinition("alreadyLazy", scanned(PlainController.class, Boolean.TRUE));
		RootBeanDefinition plainXml = new RootBeanDefinition(PlainController.class);
		plainXml.setLazyInit(false);
		bf.registerBeanDefinition("xmlBeanElement", plainXml);                              // <bean> 元素:不是扫描定义,不动

		new LazyInitXmlScanPostProcessor(true).postProcessBeanFactory(bf);

		assertTrue(bf.getBeanDefinition("plain").isLazyInit());
		assertFalse(bf.getBeanDefinition("aware").isLazyInit());
		assertNull(((AbstractBeanDefinition) bf.getBeanDefinition("annoScanned")).getLazyInit());
		assertTrue(bf.getBeanDefinition("alreadyLazy").isLazyInit());
		assertFalse(bf.getBeanDefinition("xmlBeanElement").isLazyInit());
		assertTrue(LazyInitXmlScanPostProcessor.flipped().contains("plain"));
		assertFalse(LazyInitXmlScanPostProcessor.flipped().contains("aware"));
	}

	@Test
	public void noop_when_lazy_initialization_is_off() throws Exception {
		DefaultListableBeanFactory bf = new DefaultListableBeanFactory();
		bf.registerBeanDefinition("plainOff", scanned(PlainController.class, Boolean.FALSE));
		new LazyInitXmlScanPostProcessor(false).postProcessBeanFactory(bf);
		BeanDefinition bd = bf.getBeanDefinition("plainOff");
		assertFalse(bd.isLazyInit());
		assertFalse(LazyInitXmlScanPostProcessor.flipped().contains("plainOff"));
		assertEquals(Boolean.FALSE, ((AbstractBeanDefinition) bd).getLazyInit());
	}
}
