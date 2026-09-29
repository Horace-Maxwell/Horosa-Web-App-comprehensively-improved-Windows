package boundless.spring.help.springcomp;

import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.ComponentScan.Filter;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.FilterType;
import org.springframework.stereotype.Controller;

/**
 * 旧版 11 段通配组件扫描(只收 @Controller),原样保留作回旧路径;缺省不启用,见 {@link LegacyBroadScanCondition}。
 * 全部控制器包已由 spring-mvc.xml 精确登记,本扫描在现行类路径上不贡献任何新 bean(启动账本 bean 集对拍为证)。
 */
@Configuration
@Conditional(LegacyBroadScanCondition.class)
@ComponentScan(value = "boundless.**.controller,boundless.**.springcomp,spacex.**.service,spacex.**.controller,spacex.**.helper,com.**.service,com.**.controller,com.**.helper,xio.**.service,xio.**.controller,xio.**.helper", useDefaultFilters = false, includeFilters = {
		@Filter(type = FilterType.ANNOTATION, classes = { Controller.class }) })
public class SpringWebLegacyScanConfig {
}
