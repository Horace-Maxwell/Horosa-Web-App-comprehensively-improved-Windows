package spacex.astrostudyboot;

import org.apache.tomcat.util.http.LegacyCookieProcessor;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.actuate.autoconfigure.metrics.mongo.MongoMetricsAutoConfiguration;
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

@SpringBootApplication(exclude={MongoMetricsAutoConfiguration.class,MongoAutoConfiguration.class,MongoDataAutoConfiguration.class})
@EnableAutoConfiguration(exclude={DataSourceAutoConfiguration.class,MongoMetricsAutoConfiguration.class,MongoAutoConfiguration.class,MongoDataAutoConfiguration.class})
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
		builder.run(args);
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
