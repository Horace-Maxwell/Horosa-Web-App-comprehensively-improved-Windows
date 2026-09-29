package boundless.spring.help.springcomp;

import org.springframework.context.annotation.Configuration;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.servlet.config.annotation.PathMatchConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * MVC 路径匹配口径(大小写不敏感)。
 *
 * 历史上本类还带一条 11 段 {@code **} 通配的 @ComponentScan(只收 @Controller):它把类路径上全部 jar 的
 * {@code com/} / {@code xio/} / {@code spacex/} / {@code boundless/} 树逐条走一遍(数百个 jar、近十万个类文件),
 * 而全部控制器包早已由 spring-mvc.xml 的 component-scan 精确登记 —— 通配扫描不贡献任何 bean,只贡献启动期
 * 的类路径遍历成本。现由 {@link SpringWebLegacyScanConfig} 保留原扫描,缺省关,
 * {@code -Dhorosa.scan.legacyBroad=true} 或环境变量 {@code HOROSA_JAVA_LEGACY_BROAD_SCAN=1} 回旧。
 */
@Configuration
public class SpringWebConfig implements WebMvcConfigurer{
	
	@Override
	public void configurePathMatch(PathMatchConfigurer configurer) {
		AntPathMatcher pathMatcher = new AntPathMatcher();
		pathMatcher.setCaseSensitive(false);
		configurer.setPathMatcher(pathMatcher);
	}
		
}
