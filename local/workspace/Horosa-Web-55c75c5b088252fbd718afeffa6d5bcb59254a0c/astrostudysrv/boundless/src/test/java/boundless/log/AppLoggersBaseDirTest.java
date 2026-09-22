package boundless.log;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Date;
import java.util.Map;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.core.Appender;
import org.apache.logging.log4j.core.LoggerContext;
import org.apache.logging.log4j.core.appender.RollingFileAppender;
import org.apache.logging.log4j.core.config.Configuration;
import org.apache.logging.log4j.core.config.LoggerConfig;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;

import boundless.utility.FormatUtility;

/**
 * 日志根目录解析回归:log4j2-test.xml 的 basedir 与生产同款写法(含 ${env:HOME:-${sys:user.home}}),
 * 动态日志器 / 跨日换文件 / 旧日志清理都必须落在解析后的真实目录,而不是相对 CWD 的字面目录。
 */
public class AppLoggersBaseDirTest {
	/** basedir 未经变量替换时,活文件会落到的字面目录名(相对进程 CWD)。 */
	private static final String LITERAL_HOME_DIR = "${env:HOME:-${sys:user.home}}";

	private static File literalDirUnderCwd;
	private static boolean literalDirExistedBefore;

	@BeforeClass
	public static void recordLiteralDirState(){
		literalDirUnderCwd = new File(System.getProperty("user.dir"), LITERAL_HOME_DIR);
		// CWD 下的字面目录只可能是本用例(或同一缺陷)的产物,先清掉再记初态;路径含字面标记才允许删。
		if(literalDirUnderCwd.exists() && literalDirUnderCwd.getPath().contains("${env:HOME")){
			deleteTree(literalDirUnderCwd);
		}
		literalDirExistedBefore = literalDirUnderCwd.exists();
	}

	@AfterClass
	public static void cleanupFixtures(){
		deleteTree(new File(AppLoggers.getBaseDir() + "2020"));
	}

	private static Configuration config(){
		return ((LoggerContext) LogManager.getContext(false)).getConfiguration();
	}

	private static String todayDir(){
		return FormatUtility.formatDateTime(new Date(), "yyyy/MM/dd");
	}

	private static void deleteTree(File f){
		if(f == null || !f.exists()){
			return;
		}
		File[] children = f.listFiles();
		if(children != null){
			for(File c : children){
				deleteTree(c);
			}
		}
		f.delete();
	}

	/** ① basedir 已解析:不含 ${,且落在 user.home / HOME 下。 */
	@Test
	public void baseDirIsResolvedNotRawTemplate(){
		String basedir = AppLoggers.getBaseDir();
		assertFalse("basedir 不得含未解析变量: " + basedir, basedir.contains("${"));
		String home = System.getProperty("user.home");
		String envHome = System.getenv("HOME");
		boolean underHome = basedir.startsWith(home + "/") || (envHome != null && basedir.startsWith(envHome + "/"));
		assertTrue("basedir 须以 user.home 或 HOME 开头: " + basedir, underHome);
		assertTrue("须吃到 log4j2-test.xml 的 basedir: " + basedir, basedir.endsWith("/.horosa-logs/astrostudyboot-test/"));
	}

	/** ② 动态日志器的活文件在 basedir/yyyy/MM/dd/<dir>/ 下,且不在 CWD 下造字面目录。 */
	@Test
	public void dynamicLoggerWritesUnderResolvedDateDir() throws Exception{
		org.slf4j.Logger probe = AppLoggers.getLog("error", "probe");
		probe.error("probe line");

		Appender app = config().getAppender("error/probe");
		assertTrue("动态日志器须登记为 RollingFileAppender: " + app, app instanceof RollingFileAppender);
		String fileName = ((RollingFileAppender) app).getFileName();
		assertFalse("活文件路径不得含未解析变量: " + fileName, fileName.contains("${"));
		String expectPrefix = AppLoggers.getBaseDir() + todayDir() + "/error/";
		assertTrue("活文件路径 " + fileName + " 须以 " + expectPrefix + " 开头", fileName.startsWith(expectPrefix));
		assertTrue("活文件须真实存在: " + fileName, new File(fileName).isFile());
		if(!literalDirExistedBefore){
			assertFalse("不得在 CWD 下创建字面目录 " + literalDirUnderCwd, literalDirUnderCwd.exists());
		}
	}

	/** ③ 跨日换文件后:注册表与 logger 上挂的 RollingFile 全在 basedir/今天/ 下,XML 声明的尾巴不变,且仍可写。 */
	@Test
	public void changeLogFileKeepsResolvedDateDirAndTail() throws Exception{
		AppLoggers.getLog("error", "probe");
		AppLoggers.changeLogFile();

		String prefix = AppLoggers.getBaseDir() + todayDir() + "/";
		int rolling = 0;
		boolean sawXmlAppender = false;
		for(Appender app : config().getAppenders().values()){
			if(!(app instanceof RollingFileAppender)){
				continue;
			}
			rolling++;
			String fileName = ((RollingFileAppender) app).getFileName();
			assertTrue(app.getName() + " 活文件 " + fileName + " 须以 " + prefix + " 开头", fileName.startsWith(prefix));
			if("OtherAppender".equals(app.getName())){
				sawXmlAppender = true;
				assertEquals(prefix + "all/other.log", fileName);
			}
		}
		assertTrue("至少应有 XML 声明 + 动态创建两类 RollingFile,实际 " + rolling, rolling >= 2);
		assertTrue("XML 声明的 OtherAppender 须仍在注册表", sawXmlAppender);

		for(LoggerConfig logconf : config().getLoggers().values()){
			for(Map.Entry<String, Appender> entry : logconf.getAppenders().entrySet()){
				Appender attached = entry.getValue();
				if(!(attached instanceof RollingFileAppender)){
					continue;
				}
				assertTrue(entry.getKey() + " 挂在 logger 上的实例须已启动", attached.isStarted());
				assertSame(entry.getKey() + " 注册表与 logger 上挂的须是同一实例", config().getAppender(entry.getKey()), attached);
			}
		}

		String marker = "after-change-" + System.nanoTime();
		AppLoggers.ErrorLogger.error(marker);
		File errorLog = new File(prefix + "error/error.log");
		assertTrue("换文件后 error.log 须在解析目录下: " + errorLog, errorLog.isFile());
		String content = new String(Files.readAllBytes(errorLog.toPath()), StandardCharsets.UTF_8);
		assertTrue("换文件后写入须落到新实例的文件里", content.contains(marker));
	}

	/** ④ 旧日志清理扫的是解析后的目录:40 天前的文件按 30 天阈值被删。 */
	@Test
	public void deleteOldLogsScansResolvedBaseDir() throws Exception{
		File old = new File(AppLoggers.getBaseDir() + "2020/01/01/error/old.log");
		assertTrue(old.getParentFile().isDirectory() || old.getParentFile().mkdirs());
		Files.write(old.toPath(), "old".getBytes(StandardCharsets.UTF_8));
		long fortyDaysAgo = System.currentTimeMillis() - 40L * 24 * 3600 * 1000;
		assertTrue(old.setLastModified(fortyDaysAgo));
		assertTrue(old.isFile());

		DeleteOldLogsHelper.delete(30);

		assertFalse("30 天阈值须删掉 40 天前的旧日志: " + old, old.exists());
	}
}
