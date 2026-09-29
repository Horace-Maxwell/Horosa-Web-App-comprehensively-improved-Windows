package spacex.astrostudyboot;

import org.apache.tomcat.util.http.LegacyCookieProcessor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.data.mongo.MongoDataAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.mongo.MongoAutoConfiguration;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ImportResource;

import com.thetransactioncompany.cors.CORSFilter;

import boundless.spring.help.interceptor.RSAFilter;
import boundless.utility.ProgArgsHelper;
import spacex.astrostudy.constants.ClientApp;
import spacex.basecomm.constants.ClientChannel;
import spacex.basecomm.helper.HttpHelper;
import spacex.basecomm.model.AppInfo;

@SpringBootApplication(exclude={MongoAutoConfiguration.class,MongoDataAutoConfiguration.class})
@EnableAutoConfiguration(exclude={DataSourceAutoConfiguration.class,MongoAutoConfiguration.class,MongoDataAutoConfiguration.class})
@ImportResource("classpath:conf/spring-config.xml")
public class AstroStudyProgram {

	public static void main(String[] args) {
		// 测量轮(HOROSA_JAVA_STARTUP_PROFILE=1)顺手记 main() 里 Spring 起跑前的三个刻度(相对 JVM 起点),
		// 归因「JVM 起点 → spring.boot.application.starting」这段(启动器类路径装配 / 主类静态初始化 / SpringApplication 构造)。
		final boolean profile = "1".equals(System.getenv("HOROSA_JAVA_STARTUP_PROFILE"));
		mainMark(profile, "main.enter");
		ProgArgsHelper.init(args);
		
		AppInfo info = new AppInfo();
		info.version = AstroStudyProgram.class.getPackage().getImplementationVersion();
		info.version = info.version == null ? "1.0.0" : info.version;
		info.app = ClientApp.AstroStudy.getCode() + "";
		info.channel = ClientChannel.Server.getCode() + "";
		HttpHelper.setAppInfo(info);
		mainMark(profile, "main.appinfo_done");
		
		SpringApplicationBuilder builder = new SpringApplicationBuilder(AstroStudyProgram.class).web(WebApplicationType.SERVLET);
		mainMark(profile, "main.builder_done");
		// 启动黑盒切分(测量轮专用,默认关零开销):HOROSA_JAVA_STARTUP_PROFILE=1 时缓冲
		// 全部 StartupStep,ready 后由 StartupLedgerListener 把最肥步骤写入启动账本。
		if (profile) {
			startupProfiler = new org.springframework.boot.context.metrics.buffering.BufferingApplicationStartup(8192);
			builder.application().setApplicationStartup(startupProfiler);
		}
		builder.run(args);
	}

	/** 测量轮刻度:seg=java.timeline,name=<刻度>|start=<相对 JVM 起点 ms>,ms=0;非测量轮零行为。 */
	private static void mainMark(boolean profile, String name) {
		if (!profile) {
			return;
		}
		try {
			long off = System.currentTimeMillis() - java.lang.management.ManagementFactory.getRuntimeMXBean().getStartTime();
			StartupLedgerListener.ledgerMarkNamedForMain("java.timeline", 0, name + "|start=" + off);
		} catch (Throwable ignore) {
			// best-effort
		}
	}

	// 测量轮启动分析器句柄(默认 null;StartupLedgerListener 读取后落账)。
	static volatile org.springframework.boot.context.metrics.buffering.BufferingApplicationStartup startupProfiler = null;

	// [R5-S5] 延迟初始化补全:spring.main.lazy-initialization=true 时,XML component-scan 扫出的、无启动/停机钩子的
	// 控制器/服务也翻为 lazy(Boot 自带的处理器只补「未显式设置」的定义,XML 扫描器写死了 false)。
	// -Dhorosa.lazyinit.xmlscan=false / HOROSA_JAVA_XML_SCAN_LAZY=0 回旧;lazy-initialization 未开时本处理器恒无操作。
	// 翻过的 bean 由 StartupLedgerListener 在就绪后的自热身线程里后台预实例化(HOROSA_JAVA_LAZY_PREWARM=0 关)。
	@Bean
	public static boundless.spring.help.LazyInitXmlScanPostProcessor horosaXmlScanLazyInit(org.springframework.core.env.Environment env) {
		boolean lazy = Boolean.TRUE.equals(env.getProperty("spring.main.lazy-initialization", Boolean.class, Boolean.FALSE));
		return new boundless.spring.help.LazyInitXmlScanPostProcessor(lazy);
	}
	
	private CORSFilter newCORSFilter(){
		CORSFilter corsFilter = new CORSFilter();
		
		return corsFilter;
	}
	
	@Bean
	public FilterRegistrationBean<CORSFilter> corsingFilter(){
		CORSFilter corsFilter = newCORSFilter();
		FilterRegistrationBean<CORSFilter> registration = new FilterRegistrationBean<CORSFilter>();
		
		registration.setFilter(corsFilter);
		registration.addUrlPatterns("/*");
	    registration.addInitParameter("cors.allowOrigin", "*");
	    registration.addInitParameter("cors.supportedMethods", "GET, POST, HEAD, PUT, DELETE, OPTIONS, CONNECT, TRACE, PATCH");
	    // 🔴 跨源请求头白名单:桌面前端(静态服务口)→ Java(:9999)是跨源,浏览器对带自定义头的 POST 先发 OPTIONS 预检,
	    // 不在此表的头 = 预检 403 = 整条请求被浏览器拦下(Node 探针 / jest / 差分套件全无 CORS,看不见)。
	    // 前端每新增一个 X-Horosa-* 请求头必须同步登记(jest 合同 corsHeadersContract 机械核对本串 ↔ 前端 utils 的头名)。
	    // X-Horosa-Crypto(响应加解密 v2 能力声明)/ X-Horosa-Priority(预取优先级)于 2026-09-25 补入。
	    registration.addInitParameter("cors.supportedHeaders", "Accept, Accept-Encoding, Accept-Language, Host, Origin, X-Requested-With, Content-Type, User-Agent, Content-Length, Last-Modified, Access-Control-Request-Headers, HTTP_X_REAL_IP, HTTP_X_FORWARDED_FOR, x-forwarded-for, Token, x-remote-IP, x-originating-IP, x-remote-addr, x-remote-ip, x-client-ip, x-client-IP, X-Real-ip, ImgTokenListName, SmsTokenListName, _IMGTOKENLIST, _SMSTOKENLIST, Signature, LocalIp, ClientChannel, ClientApp, ClientVer, X-Horosa-Crypto, X-Horosa-Priority");
	    registration.addInitParameter("cors.exposedHeaders", "Set-Cookie, ResultCode, ResultMessage, ImgTokenListName, SmsTokenListName, Signature, NeedLogin, Encrypted, SimpleData, RawData");
	    registration.addInitParameter("cors.supportsCredentials", "true");
	    registration.setName("CORS");
	    registration.setOrder(1);
	    
	    return registration;
	}
	
	@Bean
    public WebServerFactoryCustomizer<TomcatServletWebServerFactory> cookieProcessorCustomizer() {
        return (factory)->factory.addContextCustomizers((context)->context.setCookieProcessor(new LegacyCookieProcessor()));
    }

	// 🔥 Hystrix 核心预热:进程内**首次执行任意 HystrixCommand** 会初始化 Hystrix 核心(RxJava 调度器 /
	// 指标发布 / 插件注册 / 线程池),约 1-2s(Hystrix 首用通病)。每次重启软件后,首个经 Java 转发 Python 的
	// 请求(无论哪个技法,如印度占星)都要吃这一下 → 表现为「重启后首次进入某技法卡 ~3s」。这里启动后用后台
	// 线程跑一个 trivial 命令把核心提前热好,后续真实转发不再付这笔冷启动。后台线程不阻塞启动;失败静默不影响服务。
	@Bean
	public CommandLineRunner hystrixCoreWarmup() {
		return (args) -> {
			Thread t = new Thread(() -> {
				try {
					new com.netflix.hystrix.HystrixCommand<String>(
							com.netflix.hystrix.HystrixCommandGroupKey.Factory.asKey("warmup")) {
						@Override
						protected String run() {
							return "ok";
						}
					}.execute();
				} catch (Throwable ignore) {
				}
			}, "hystrix-core-warmup");
			t.setDaemon(true);
			t.start();
		};
	}

//	@Bean
//	public FilterRegistrationBean<RSAFilter> rsaFilter(){
//		RSAFilter filter = new RSAFilter();
//		FilterRegistrationBean<RSAFilter> reg = new FilterRegistrationBean<RSAFilter>();
//		reg.setFilter(filter);
//		reg.setOrder(2);
//		
//		reg.addUrlPatterns("/*");
//		reg.setName("RSAFilter");
//		
//		return reg;
//	}
	

}
