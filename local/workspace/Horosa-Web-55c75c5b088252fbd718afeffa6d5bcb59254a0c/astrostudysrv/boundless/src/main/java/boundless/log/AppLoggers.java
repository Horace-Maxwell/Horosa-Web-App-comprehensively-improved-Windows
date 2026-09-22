package boundless.log;

import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.core.Appender;
import org.apache.logging.log4j.core.LoggerContext;
import org.apache.logging.log4j.core.appender.ConsoleAppender;
import org.apache.logging.log4j.core.appender.ConsoleAppender.Target;
import org.apache.logging.log4j.core.appender.RollingFileAppender;
import org.apache.logging.log4j.core.appender.rolling.TimeBasedTriggeringPolicy;
import org.apache.logging.log4j.core.config.AbstractConfiguration;
import org.apache.logging.log4j.core.config.AppenderRef;
import org.apache.logging.log4j.core.config.Configuration;
import org.apache.logging.log4j.core.config.LoggerConfig;
import org.apache.logging.log4j.core.layout.PatternLayout;
import org.apache.logging.slf4j.Log4jLogger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import boundless.spring.help.PropertyPlaceholder;
import boundless.types.Tuple;
import boundless.utility.FormatUtility;
import boundless.utility.PeriodTask;
import boundless.utility.StringUtility;

public class AppLoggers {
	private static int today;

	private static final LoggerContext ctx;
	private static final Configuration config;
	
	private static boolean logToConsole = false;

	private static Map<String, Tuple<Logger, org.apache.logging.log4j.core.Logger>> loggers;

	private static Appender consoleAppender;
	
	private static String noToConsole;
	private static Set<String> noconsoleSet = new HashSet<String>();
	
	private static boolean hasPeriodTask = false;
	
	public static Logger ErrorLogger;
	public static Logger WarnLogger;
	public static Logger InfoLogger;
	public static Logger DebugLogger;
	
	public static Logger Access;

	public static Logger Performance;
	
	static{
		logToConsole = PropertyPlaceholder.getProperty("logtoconsole", false);
		noToConsole = PropertyPlaceholder.getProperty("log.no.to.console", "BoringAppender");
		
		if(!StringUtility.isNullOrEmpty(noToConsole)) {
			noconsoleSet = StringUtility.splitToStringSet(noToConsole, ',');			
		}
		
		ctx = (LoggerContext) LogManager.getContext(false);
		config = ctx.getConfiguration();
		loggers = new HashMap<String, Tuple<Logger, org.apache.logging.log4j.core.Logger>>();
		
				
		build();
	}
	
	public static void initConsoleAppender() {
		logToConsole = PropertyPlaceholder.getProperty("logtoconsole", false);
		noToConsole = PropertyPlaceholder.getProperty("log.no.to.console", "BoringAppender");
		
		if(!StringUtility.isNullOrEmpty(noToConsole)) {
			noconsoleSet = StringUtility.splitToStringSet(noToConsole, ',');			
		}
		
		boolean devmod = PropertyPlaceholder.getPropertyAsBool("devmod", false);
		if(devmod) {
			logToConsole = true;
		}

		consoleAppender = config.getAppender("Console");
		if(consoleAppender == null) {
			String prjname = config.getStrSubstitutor().getVariableResolver().lookup("prjname");
			if(StringUtility.isNullOrEmpty(prjname)){
				prjname = "%t";
			}
			StringBuilder psb = new StringBuilder("%d{yyyy-MM-dd HH:mm:ss.SSS} ");
			psb.append(prjname).append(" %-5level- %msg%n");
			
			PatternLayout layout = PatternLayout.newBuilder().withCharset(Charset.forName("utf-8")).withPattern(psb.toString()).build();

			consoleAppender = ConsoleAppender.newBuilder()
				.setLayout(layout).setName("Console").setTarget(Target.SYSTEM_OUT)
				.build();
			
			config.addAppender(consoleAppender);
		}	
		
	    if(logToConsole) {
	    	AbstractConfiguration conf = (AbstractConfiguration)config;
	    	Map<String, LoggerConfig> logconfigs = conf.getLoggers();

			for(Map.Entry<String, LoggerConfig> entry : logconfigs.entrySet()) {
				LoggerConfig cnf = entry.getValue();
				Map<String, Appender> appenders = cnf.getAppenders();
				if(appenders.containsKey("Console")) {
					continue;
				}
				boolean needconsole = false;
				for(AppenderRef ref : cnf.getAppenderRefs()) {
					String str = ref.getRef();
					if(!noconsoleSet.contains(str)) {
						needconsole = true;
						break;
					}
				}
				if(needconsole) {
					cnf.addAppender(consoleAppender, null, null);					
				}
			}
	    }
	}
	
	public static void build(){
		initConsoleAppender();
		
		ErrorLogger = getLogWithoutUpdate("error", "error", Level.DEBUG);
		WarnLogger = getLogWithoutUpdate("warn", "warn", Level.DEBUG);
		InfoLogger = getLogWithoutUpdate("info", "info", Level.DEBUG);
		DebugLogger = getLogWithoutUpdate("debug", "debug", Level.DEBUG);
		Performance = getLogWithoutUpdate("perf", "perf", Level.DEBUG);
		Access = getLogWithoutUpdate("access", "access", Level.DEBUG);

		ctx.updateLoggers();
		
		today = Calendar.getInstance().get(Calendar.DAY_OF_YEAR);
		
		if(!hasPeriodTask) {
			hasPeriodTask = true;
			PeriodTask.submit(()->checkTime(), 600000, 60000);			
		}
	}	
	
	private static void checkTime(){
		int now = Calendar.getInstance().get(Calendar.DAY_OF_YEAR);
		if(now == today){
			return;
		}
		// 先推进日期再换文件:换文件抛错也不能让之后每分钟无限重试(每次重试都会再建一批 appender)
		today = now;
		try{
			changeLogFile();
		}catch(Exception e){
			QueueLog.error(ErrorLogger, e, "changeLogFile failed");
		}
	}
	
	/** 变量解析失败时的兜底目录尾巴,与 log4j2.xml 里 basedir 的缺省口径一致。 */
	private static final String FALLBACK_BASEDIR_TAIL = "/.horosa-logs/astrostudyboot";

	/** 「日志根/」之后紧跟的日期目录段 yyyy/MM/dd/。 */
	private static final Pattern DATE_DIR_HEAD = Pattern.compile("^\\d{4}/\\d{2}/\\d{2}/");

	/**
	 * 解析后的日志根目录(恒以 / 结尾)。
	 * 直接 lookup("basedir") 拿到的是 Properties 里的原始串(log4j 2.17.1 起属性值存原文,
	 * 形如 ${env:HOME:-${sys:user.home}}/...,不递归替换),拿它拼路径会在进程 CWD 下造出同名字面目录;
	 * 必须经 StrSubstitutor 递归替换,替换失败或仍含 ${ 时退回 user.home 下的缺省目录。
	 */
	// HOROSA_LOG_BASEDIR_REV log_basedir_v1 —— Windows 桌面日志目录:启动器(桌面壳 / 本地版脚本)传入的
	// -Dhorosa.log.basedir 优先(Java 日志与壳日志同落应用数据目录 logs/,诊断导出与「打开日志目录」都指向那里);
	// 无该 -D 时走下面上游的 ${basedir} 递归替换 + user.home 兜底,行为与上游逐字一致 → 服务器/mac 部署零变化。
	// 常量兼作重建 jar 的存在性哨兵标记(release_selfcheck 验发货 jar 内含此串,防止同步冲掉本残差)。
	public static final String HOROSA_LOG_BASEDIR_REV = "log_basedir_v1";

	static String resolvedBaseDir(){
		String prop = System.getProperty("horosa.log.basedir");
		if(!StringUtility.isNullOrEmpty(prop)){
			String p = prop.replace('\\', '/');
			return p.endsWith("/") ? p : p + "/";
		}
		String b = null;
		try{
			b = config.getStrSubstitutor().replace("${basedir}");
		}catch(Exception e){
			b = null;
		}
		if(StringUtility.isNullOrEmpty(b) || b.indexOf("${") >= 0){
			b = System.getProperty("user.home") + FALLBACK_BASEDIR_TAIL;
		}
		return b.endsWith("/") ? b : b + "/";
	}

	/**
	 * 取「日志根/yyyy/MM/dd/」之后的相对尾巴(如 error/error.log、all/other_%d{yyyyMMdd_HH}_%i.log);
	 * 路径不在日志根下或日期段形状不符则返回 null,调用方跳过——绝不再按固定长度硬切。
	 */
	static String tailUnderDateDir(String path, String basedir){
		if(StringUtility.isNullOrEmpty(path) || StringUtility.isNullOrEmpty(basedir)){
			return null;
		}
		String base = basedir.endsWith("/") ? basedir : basedir + "/";
		if(!path.startsWith(base)){
			return null;
		}
		String rest = path.substring(base.length());
		Matcher m = DATE_DIR_HEAD.matcher(rest);
		if(!m.find()){
			return null;
		}
		String tail = rest.substring(m.end());
		return tail.length() == 0 ? null : tail;
	}

	public static String getBaseDir(){
		return resolvedBaseDir();
	}

	private static boolean attachedToAnyLogger(Map<String, LoggerConfig> logconfigs, String key){
		for(LoggerConfig logconf : logconfigs.values()){
			if(logconf.getAppenders().get(key) instanceof RollingFileAppender){
				return true;
			}
		}
		return false;
	}
	
	synchronized public static void changeLogFile(){
		AbstractConfiguration conf = (AbstractConfiguration)config;
		String basedir = resolvedBaseDir();

		Map<String, LoggerConfig> logconfigs = conf.getLoggers();
		
		Map<String, Appender> appenders = conf.getAppenders();
		Map<String, RollingFileAppender> tmpappenders = new HashMap<String, RollingFileAppender>();
		
		Date now = new Date();
		StringBuilder commdir = new StringBuilder(basedir);
		commdir.append(FormatUtility.formatDateTime(now, "yyyy/MM/dd")).append("/");

		for(Map.Entry<String, Appender> entry : appenders.entrySet()){
			String key = entry.getKey();
			Appender app = entry.getValue();

			if(!(app instanceof RollingFileAppender)){
				continue;
			}
			// 没挂到任何 logger 上的 appender 不换(建了也没人写,只会白开一个文件句柄)
			if(!attachedToAnyLogger(logconfigs, key)){
				continue;
			}
			RollingFileAppender rollapp = (RollingFileAppender)app;
			String fn = tailUnderDateDir(rollapp.getFileName(), basedir);
			String pattern = tailUnderDateDir(rollapp.getFilePattern(), basedir);
			if(fn == null || pattern == null){
				continue;
			}
			try{
				RollingFileAppender appender = RollingFileAppender.newBuilder()
						.withFileName(commdir.toString() + fn).withFilePattern(commdir.toString() + pattern)
						.withPolicy(rollapp.getTriggeringPolicy()).withBufferedIo(false).withImmediateFlush(true)
						.setLayout(rollapp.getLayout()).setName(key).setConfiguration(config)
						.build();
				if(appender == null){
					QueueLog.error(ErrorLogger, "changeLogFile rebuild appender returned null: " + key);
					continue;
				}
				appender.addFilter(rollapp.getFilter());
				tmpappenders.put(key, appender);
			}catch(Exception e){
				QueueLog.error(ErrorLogger, e, "changeLogFile rebuild appender failed: " + key);
			}
		}
		
		// 逐个换成新一天的实例:先把旧实例从所有 logger 与配置注册表摘下并停掉(注册表里那份通常
		// 就是挂着的那份,按实例去重、每个旧实例只 stop 一次——重复 stop 会把共享文件管理器的引用计数
		// 减到 0,误关刚起的新实例),再挂新实例并登记回注册表,让 getAppenders() 与 logger 上挂的一致。
		Set<Appender> stopped = Collections.newSetFromMap(new IdentityHashMap<Appender, Boolean>());
		for(Map.Entry<String, RollingFileAppender> entry : tmpappenders.entrySet()){
			String key = entry.getKey();
			RollingFileAppender newapp = entry.getValue();
			List<LoggerConfig> owners = new ArrayList<LoggerConfig>();
			List<Appender> olds = new ArrayList<Appender>();
			for(LoggerConfig logconf : logconfigs.values()){
				Appender attached = logconf.getAppenders().get(key);
				if(attached instanceof RollingFileAppender){
					owners.add(logconf);
					olds.add(attached);
				}
			}
			try{
				Appender registered = conf.getAppender(key);
				conf.removeAppender(key);
				if(registered != null){
					stopped.add(registered);
				}
				for(Appender old : olds){
					if(stopped.add(old)){
						old.stop();
					}
				}
				newapp.start();
				for(LoggerConfig owner : owners){
					owner.addAppender(newapp, owner.getLevel(), owner.getFilter());
				}
				config.addAppender(newapp);
			}catch(Exception e){
				QueueLog.error(ErrorLogger, e, "changeLogFile swap appender failed: " + key);
			}
		}
		
	    ctx.updateLoggers();
		
	}
	
	private static Tuple<Logger, org.apache.logging.log4j.core.Logger> createLog(String logdir, String name, Level level){
		AbstractConfiguration conf = (AbstractConfiguration)config;
		String basedir = resolvedBaseDir();
		
		if(logdir.startsWith("/")){
			logdir = logdir.substring(1);
		}
		if(logdir.length() > 0 && !logdir.endsWith("/")){
			logdir += "/";
		}
		
		String key = logdir + name;
		
		String prjname = config.getStrSubstitutor().getVariableResolver().lookup("prjname");
		if(StringUtility.isNullOrEmpty(prjname)){
			prjname = "%t";
		}
		StringBuilder psb = new StringBuilder("%d{yyyy-MM-dd HH:mm:ss.SSS} ");
		psb.append(prjname).append(" %-5level- %msg%n");
		
		PatternLayout layout = PatternLayout.newBuilder().withCharset(Charset.forName("utf-8")).withPattern(psb.toString()).build();
		
		Date now = new Date();
		StringBuilder filename = new StringBuilder(basedir);
		filename.append(FormatUtility.formatDateTime(now, "yyyy/MM/dd")).append("/");
		filename.append(logdir).append(name);
		
		StringBuilder filepattern = new StringBuilder(filename.toString());
		filepattern.append("_%d{yyyyMMdd_HH}.log");
		
		TimeBasedTriggeringPolicy tmpolicy = TimeBasedTriggeringPolicy.newBuilder().withModulate(true).withInterval(1).build();
		
		RollingFileAppender appender = RollingFileAppender.newBuilder()
				.withFileName(filename.toString() + ".log").withFilePattern(filepattern.toString())
				.withPolicy(tmpolicy)
				.withBufferedIo(false).withImmediateFlush(true)
				.setLayout(layout).setName(key).setConfiguration(config)
				.build();
		appender.start();
		
		Appender tmpappender = conf.getAppender(key);
		if(tmpappender != null){
			conf.removeAppender(key);
			tmpappender.stop();
		}
		config.addAppender(appender);
		
		AppenderRef ref = AppenderRef.createAppenderRef(key, null, null);
		AppenderRef[] refs = new AppenderRef[] {ref};
		LoggerConfig loggerConfig = LoggerConfig.createLogger(false, level, key,
	            "true", refs, null, config, null );
	    loggerConfig.addAppender(appender, null, null);
	    
	    if(logToConsole) {
	    	loggerConfig.addAppender(consoleAppender, null, null);
	    }
	    
	    conf.removeLogger(key);
	    config.addLogger(key, loggerConfig);
	    
	    org.apache.logging.log4j.core.Logger coreLog = ctx.getLogger(key);
	    Log4jLogger log = new Log4jLogger(coreLog, key);
	    	 
	    return new Tuple<Logger, org.apache.logging.log4j.core.Logger>(log, coreLog);
		
	}
	
	public static Logger getLog(String logdir, String name){
		try{
			return getLog(logdir, name, Level.ALL);
		}catch(Exception e){
			System.out.println(e.getMessage());
			return LoggerFactory.getLogger(name);
		}
	}

	synchronized public static Logger getLog(String logdir, String name, Level level){
		if(logdir.startsWith("/")){
			logdir = logdir.substring(1);
		}
		if(logdir.length() > 0 && !logdir.endsWith("/")){
			logdir += "/";
		}
		
		String key = logdir + name;
		Tuple<Logger, org.apache.logging.log4j.core.Logger> tuple = loggers.get(key);
		if(tuple != null){
			return tuple.item1();
		}
		
		tuple = createLog(logdir, name, level);
	    ctx.updateLoggers();

	    loggers.put(key, tuple);
	    
	    return tuple.item1();
	}
	
	synchronized private  static Logger getLogWithoutUpdate(String logdir, String name, Level level){
		try{
			if(logdir.startsWith("/")){
				logdir = logdir.substring(1);
			}
			if(logdir.length() > 0 && !logdir.endsWith("/")){
				logdir += "/";
			}
			
			String key = logdir + name;
			Tuple<Logger, org.apache.logging.log4j.core.Logger> tuple = loggers.get(key);
			if(tuple != null){
				return tuple.item1();
			}
			
			tuple = createLog(logdir, name, level);

		    loggers.put(key, tuple);
		    
		    return tuple.item1();
		}catch(Exception e){
			System.out.println(e.getMessage());
			return LoggerFactory.getLogger(name);
		}
	}
}
