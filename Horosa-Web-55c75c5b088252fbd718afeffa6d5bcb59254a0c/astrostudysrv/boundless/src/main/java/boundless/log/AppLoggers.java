package boundless.log;

import java.nio.charset.Charset;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

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
		changeLogFile();
		today = now;
	}
	
	public static String getBaseDir(){
		AbstractConfiguration conf = (AbstractConfiguration)config;
		String basedir = conf.getStrSubstitutor().getVariableResolver().lookup("basedir");
		basedir = StringUtility.isNullOrEmpty(basedir) ? "/" : basedir;
		if(!basedir.endsWith("/")){
			basedir = basedir + "/";
		}

		return basedir;
	}
	
	synchronized public static void changeLogFile(){
		AbstractConfiguration conf = (AbstractConfiguration)config;
		String basedir = config.getStrSubstitutor().getVariableResolver().lookup("basedir");
		basedir = StringUtility.isNullOrEmpty(basedir) ? "/" : basedir;
		if(!basedir.endsWith("/")){
			basedir = basedir + "/";
		}

		Map<String, LoggerConfig> logconfigs = conf.getLoggers();
		
		Map<String, Appender> appenders = conf.getAppenders();
		Map<String, Appender> tmpappenders = new HashMap<String, Appender>();
		
		for(Map.Entry<String, Appender> entry : appenders.entrySet()){
			String key = entry.getKey();
			Appender app = entry.getValue();

			if(app instanceof RollingFileAppender){
				RollingFileAppender rollapp = (RollingFileAppender)app;
				String fn = rollapp.getFileName().substring(basedir.length() + 11);
				String pattern = rollapp.getFilePattern().substring(basedir.length() + 11);
				
				Date now = new Date();
				StringBuilder commdir = new StringBuilder(basedir);
				commdir.append(FormatUtility.formatDateTime(now, "yyyy/MM/dd")).append("/");
				
				RollingFileAppender appender = RollingFileAppender.newBuilder()
						.withFileName(commdir.toString() + fn).withFilePattern(commdir.toString() + pattern)
						.withPolicy(rollapp.getTriggeringPolicy()).withBufferedIo(false).withImmediateFlush(true)
						.setLayout(rollapp.getLayout()).setName(key).setConfiguration(config)
						.build();
				appender.addFilter(rollapp.getFilter());
				tmpappenders.put(key, appender);
			}
		}
		
		Map<String, Appender> oldapps = new HashMap<String, Appender>();
		for(Map.Entry<String, LoggerConfig> entry : logconfigs.entrySet()){
			LoggerConfig logconf = entry.getValue();
			for(Map.Entry<String, Appender> appentry : logconf.getAppenders().entrySet()){
				String appkey = appentry.getKey();
				Appender app = appentry.getValue();
				if(!(app instanceof RollingFileAppender)){
					continue;
				}
				oldapps.put(appkey, app);
			}
		}
		
		Set<String> newappset = new HashSet<String>();
		for(Map.Entry<String, LoggerConfig> entry : logconfigs.entrySet()){
			LoggerConfig logconf = entry.getValue();
			for(Map.Entry<String, Appender> appentry : logconf.getAppenders().entrySet()){
				String appkey = appentry.getKey();
				Appender logapp = appentry.getValue();
				if(!(logapp instanceof RollingFileAppender)){
					continue;
				}
				if(newappset.contains(appkey)){
					logconf.removeAppender(appkey);
					logconf.addAppender(tmpappenders.get(appkey), logconf.getLevel(), logconf.getFilter());
					continue;
				}
				
				Appender app = oldapps.get(appkey);
				app.stop();
				logconf.removeAppender(appkey);

				Appender newapp = tmpappenders.get(appkey);
				newapp.start();
				
				logconf.addAppender(newapp, logconf.getLevel(), logconf.getFilter());
				newappset.add(appkey);
			}
		}
		
	    ctx.updateLoggers();
		
	}
	
	private static Tuple<Logger, org.apache.logging.log4j.core.Logger> createLog(String logdir, String name, Level level){
		AbstractConfiguration conf = (AbstractConfiguration)config;
		String basedir = config.getStrSubstitutor().getVariableResolver().lookup("basedir");
		basedir = StringUtility.isNullOrEmpty(basedir) ? "/" : basedir;
		if(!basedir.endsWith("/")){
			basedir = basedir + "/";
		}
		
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
