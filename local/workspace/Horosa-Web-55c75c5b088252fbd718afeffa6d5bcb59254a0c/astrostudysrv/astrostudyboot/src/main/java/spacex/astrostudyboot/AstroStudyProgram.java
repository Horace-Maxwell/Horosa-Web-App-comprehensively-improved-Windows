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
		ProgArgsHelper.init(args);
		
		AppInfo info = new AppInfo();
		info.version = AstroStudyProgram.class.getPackage().getImplementationVersion();
		info.version = info.version == null ? "1.0.0" : info.version;
		info.app = ClientApp.AstroStudy.getCode() + "";
		info.channel = ClientChannel.Server.getCode() + "";
		HttpHelper.setAppInfo(info);
		
		SpringApplicationBuilder builder = new SpringApplicationBuilder(AstroStudyProgram.class).web(WebApplicationType.SERVLET);
		// 启动黑盒切分(测量轮专用,默认关零开销):HOROSA_JAVA_STARTUP_PROFILE=1 时缓冲
		// 全部 StartupStep,ready 后由 StartupLedgerListener 把最肥步骤写入启动账本。
		if ("1".equals(System.getenv("HOROSA_JAVA_STARTUP_PROFILE"))) {
			startupProfiler = new org.springframework.boot.context.metrics.buffering.BufferingApplicationStartup(8192);
			builder.application().setApplicationStartup(startupProfiler);
		}
		builder.run(args);
	}

	// 测量轮启动分析器句柄(默认 null;StartupLedgerListener 读取后落账)。
	static volatile org.springframework.boot.context.metrics.buffering.BufferingApplicationStartup startupProfiler = null;
	
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
	    registration.addInitParameter("cors.supportedHeaders", "Accept, Accept-Encoding, Accept-Language, Host, Origin, X-Requested-With, Content-Type, User-Agent, Content-Length, Last-Modified, Access-Control-Request-Headers, HTTP_X_REAL_IP, HTTP_X_FORWARDED_FOR, x-forwarded-for, Token, x-remote-IP, x-originating-IP, x-remote-addr, x-remote-ip, x-client-ip, x-client-IP, X-Real-ip, ImgTokenListName, SmsTokenListName, _IMGTOKENLIST, _SMSTOKENLIST, Signature, LocalIp, ClientChannel, ClientApp, ClientVer");
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

	// 🔥 v3.0.1 perf ROUND-4 P1 (HOROSA_CHART_WARMUP):八字/农历装配预热。B0 分段实测:重启后用户首个
	// /chart 的 9.7s 里 **baziAssemble=7781ms(80%)** —— OnlyFourColumns/NongliHelper 的首次执行一次性付
	// 类初始化 + 历法表加载 + JIT(python=1884ms 是真算力,predictSign/predSync≈0)。这里在启动后用后台
	// 守护线程以固定合成参数预跑一次同路径(构造 + getNongli),把这笔一次性成本挪出用户首盘。
	// 字节级安全:纯计算、无写库、结果丢弃;与 ChartController 首次调用触发的是同一批类初始化,先跑=后跑。
	// 失败静默(首盘退回自付,现状)。Kill-switch:HOROSA_CHART_WARMUP=0。bazi_warmup_v1 兼作 jar 哨兵。
	public static final String HOROSA_CHART_WARMUP_REV = "bazi_warmup_v1";

	@Bean
	public CommandLineRunner baziAssembleWarmup() {
		return (args) -> {
			String off = System.getenv("HOROSA_CHART_WARMUP");
			if (off != null && (off.equals("0") || off.equalsIgnoreCase("false") || off.equalsIgnoreCase("no") || off.equalsIgnoreCase("off"))) {
				return;
			}
			Thread t = new Thread(() -> {
				try {
					// 与 ChartController./chart 内的装配调用完全同构;生日取**当前时刻**:B0 实测 baziAssemble
					// 的大头是 nongli 年表「首次(year,zone)组合」的重计算+逐条持久化(之后命中秒回),而应用
					// 打开时自动排的正是 now 盘 —— 用 now 预热恰好预填首盘要用的同一张年表。输出丢弃;缓存内容
					// 与任何一次真实计算完全一致(确定性纯计算)→ 响应字节级不变。zone 取 +08:00(主用户群;
					// 其他时区用户首盘自付一次,与现状同)。
					String nowBirth = new java.text.SimpleDateFormat("yyyy/MM/dd HH:mm:ss").format(new java.util.Date());
					spacex.astrostudycn.model.OnlyFourColumns bz = new spacex.astrostudycn.model.OnlyFourColumns(
							1, nowBirth, "+08:00", "121e28", "31n14", true,
							spacex.astrostudycn.constants.BaZiGender.Male,
							spacex.astrostudycn.constants.TimeZiAlg.RealSun, false, true);
					bz.getNongli();
				} catch (Throwable ignore) {
					// 非致命:冷路径改由用户首盘承担(与修复前一致)
				}
			}, "bazi-assemble-warmup");
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
