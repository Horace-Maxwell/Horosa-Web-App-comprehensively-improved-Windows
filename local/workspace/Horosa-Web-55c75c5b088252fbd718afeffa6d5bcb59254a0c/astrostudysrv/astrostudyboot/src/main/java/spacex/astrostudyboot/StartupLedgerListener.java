package spacex.astrostudyboot;

import java.lang.management.ManagementFactory;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.List;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.stereotype.Component;

import boundless.spring.help.LazyInitXmlScanPostProcessor;
import spacex.astrostudycn.model.OnlyFourColumns;

/**
 * 结构化启动账本(Java 层写入端)+ 进程内自热身(WS-3b)。
 *
 * 账本:四层进程(Rust/shell/Java/Python)经 env 共享同一 JSON Lines 文件:
 *   HOROSA_LEDGER_FILE      账本文件绝对路径(缺省=不写,零开销)
 *   HOROSA_RUN_TAG          本次启动运行标签(四层同值,可按 run 聚合)
 *   HOROSA_STARTUP_LEDGER=0 总开关(默认开)
 * 段 java.jvm_to_ctx_ready:JVM 进程起点(RuntimeMXBean.getStartTime,含 JVM 自身
 * 初始化)到 Spring ApplicationReadyEvent 的毫秒——Java 侧启动黑盒的单一权威数字。
 *
 * 自热身:ready 后 daemon 线程异步把「就绪后第一下点击」要付的冷类加载/JIT/历法表
 * 初始化成本挪进空闲(进程内直调计算类,不走 HTTP/RSA,不占启动关键路径,不与
 * 用户请求抢连接)。段 java.self_warmup{ms};HOROSA_JAVA_SELF_WARMUP=0 关。
 * 同一线程随后把启动期被翻为 lazy 的 XML 扫描 bean(见 LazyInitXmlScanPostProcessor)在后台预实例化
 * (段 java.lazy_prewarm,name=beans=N;HOROSA_JAVA_LAZY_PREWARM=0 关),首个真实请求不付实例化成本。
 * 写入 append + best-effort 吞错:账本与热身绝不影响业务。
 *
 * 测量轮附件(缺省全关、零行为差):
 *   HOROSA_JAVA_STARTUP_PROFILE=1      缓冲 StartupStep,ready 后按耗时降序取前 N 条写 java.step
 *                                     (N 由 HOROSA_JAVA_STARTUP_PROFILE_TOP 定,缺省 40),并把应用级步骤
 *                                     (spring.boot.application.* / spring.context.refresh / spring.boot.webserver.create)
 *                                     连同相对 JVM 起点的起始偏移写 java.timeline(name=步骤|start=偏移ms)
 *   HOROSA_JAVA_BEAN_DUMP=<file>       ready 后把 bean 定义集(名 / 类 / lazy / 是否已实例化 / 来源)、
 *                                     全部 RequestMapping 处理器方法、自动配置条件评估结果写成 JSON —— 供改前改后
 *                                     「bean 集与端点集逐字相同」对拍(零功能差的机械证据)
 */
@Component
public class StartupLedgerListener implements ApplicationListener<ApplicationReadyEvent> {

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        ledgerMark("java.jvm_to_ctx_ready", jvmUptimeMs());
        drainStartupProfile();
        dumpBeans(event.getApplicationContext());
        selfWarmupAsync(event.getApplicationContext());
    }

    /**
     * 测量轮黑盒切分:HOROSA_JAVA_STARTUP_PROFILE=1 时(见 AstroStudyProgram.main),
     * 把缓冲的 StartupStep 时间线按耗时降序取前 N 条写入账本(seg=java.step,
     * name 含步骤名+首个 tag,如 spring.beans.instantiate|beanName=xxx)。
     * 默认关=profiler 句柄为 null=零行为差;写入 best-effort 吞错。
     */
    private static void drainStartupProfile() {
        try {
            org.springframework.boot.context.metrics.buffering.BufferingApplicationStartup profiler =
                    AstroStudyProgram.startupProfiler;
            if (profiler == null) {
                return;
            }
            int limit = 40;
            try {
                String top = System.getenv("HOROSA_JAVA_STARTUP_PROFILE_TOP");
                if (top != null && !top.trim().isEmpty()) {
                    limit = Math.max(1, Integer.parseInt(top.trim()));
                }
            } catch (Throwable ignore) {
                limit = 40;
            }
            long jvmStart = ManagementFactory.getRuntimeMXBean().getStartTime();
            java.util.List<long[]> idx = new java.util.ArrayList<>();
            java.util.List<String> names = new java.util.ArrayList<>();
            for (org.springframework.boot.context.metrics.buffering.StartupTimeline.TimelineEvent ev
                    : profiler.getBufferedTimeline().getEvents()) {
                if (ev.getStartTime() == null || ev.getEndTime() == null) {
                    continue;
                }
                long ms = java.time.Duration.between(ev.getStartTime(), ev.getEndTime()).toMillis();
                String stepName = ev.getStartupStep().getName();
                StringBuilder name = new StringBuilder(stepName);
                for (org.springframework.core.metrics.StartupStep.Tag tag : ev.getStartupStep().getTags()) {
                    name.append('|').append(tag.getKey()).append('=').append(tag.getValue());
                    break; // 首 tag 足以定位(beanName/source),防行爆长
                }
                idx.add(new long[]{ms, names.size()});
                names.add(name.toString());
                // 应用级步骤连起始偏移一起落账:refresh 之外的时间(JVM 起点→run()→environment→context)才能归因
                if (stepName.startsWith("spring.boot.application.") || "spring.context.refresh".equals(stepName)
                        || stepName.startsWith("spring.boot.webserver.")) {
                    long startOff = ev.getStartTime().toEpochMilli() - jvmStart;
                    ledgerMarkNamed("java.timeline", ms, stepName + "|start=" + startOff);
                }
            }
            idx.sort((a, b) -> Long.compare(b[0], a[0]));
            int n = Math.min(limit, idx.size());
            for (int i = 0; i < n; i++) {
                ledgerMarkNamed("java.step", idx.get(i)[0], names.get((int) idx.get(i)[1]));
            }
            ledgerMarkNamed("java.step_total", idx.size(), "buffered_steps");
        } catch (Throwable ignore) {
            // 测量 best-effort:任何异常吞掉,绝不影响服务。
        }
    }

    /**
     * 测量轮 bean 集快照:HOROSA_JAVA_BEAN_DUMP=<file> 时写 JSON(缺省不写,零行为差)。
     * 先取「已实例化单例」集再碰任何 bean(取处理器映射会实例化惰性映射 bean,须在其后)。
     */
    private static void dumpBeans(ConfigurableApplicationContext ctx) {
        String file = System.getenv("HOROSA_JAVA_BEAN_DUMP");
        if (file == null || file.trim().isEmpty()) {
            return;
        }
        try {
            org.springframework.beans.factory.config.ConfigurableListableBeanFactory bf = ctx.getBeanFactory();
            String[] names = bf.getBeanDefinitionNames();
            java.util.Arrays.sort(names);
            java.util.Set<String> singletons = new java.util.TreeSet<>(java.util.Arrays.asList(bf.getSingletonNames()));
            java.util.List<java.util.Map<String, Object>> defs = new java.util.ArrayList<>();
            int instantiated = 0;
            for (String name : names) {
                org.springframework.beans.factory.config.BeanDefinition bd = bf.getBeanDefinition(name);
                java.util.Map<String, Object> row = new java.util.LinkedHashMap<>();
                row.put("name", name);
                String cls = bd.getBeanClassName();
                if (cls == null && bd.getFactoryMethodName() != null) {
                    cls = (bd.getFactoryBeanName() == null ? "" : bd.getFactoryBeanName() + ".") + bd.getFactoryMethodName() + "()";
                }
                row.put("class", cls);
                row.put("lazy", bd.isLazyInit());
                row.put("scope", bd.getScope());
                boolean inst = singletons.contains(name);
                row.put("instantiated", inst);
                if (inst) {
                    instantiated++;
                }
                row.put("source", bd.getResourceDescription());
                defs.add(row);
            }
            java.util.SortedSet<String> handlers = new java.util.TreeSet<>();
            java.util.Map<String, org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping> maps =
                    ctx.getBeansOfType(org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping.class);
            for (java.util.Map.Entry<String, org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping> e : maps.entrySet()) {
                e.getValue().getHandlerMethods().forEach((info, hm) ->
                        handlers.add(e.getKey() + " " + info + " -> " + hm.getBeanType().getName() + "#" + hm.getMethod().getName()));
            }
            java.util.SortedSet<String> positive = new java.util.TreeSet<>();
            java.util.SortedSet<String> negative = new java.util.TreeSet<>();
            java.util.SortedSet<String> exclusions = new java.util.TreeSet<>();
            java.util.SortedSet<String> unconditional = new java.util.TreeSet<>();
            try {
                org.springframework.boot.autoconfigure.condition.ConditionEvaluationReport rep =
                        org.springframework.boot.autoconfigure.condition.ConditionEvaluationReport.get(bf);
                rep.getConditionAndOutcomesBySource().forEach((src, outcomes) -> {
                    if (outcomes.isFullMatch()) {
                        positive.add(src);
                    } else {
                        negative.add(src);
                    }
                });
                exclusions.addAll(rep.getExclusions());
                unconditional.addAll(rep.getUnconditionalClasses());
            } catch (Throwable ignore) {
                // 条件报告缺席(非 Boot 上下文)则只出 bean 集
            }
            java.util.Map<String, Object> out = new java.util.LinkedHashMap<>();
            out.put("definitions", defs.size());
            out.put("instantiatedAtReady", instantiated);
            out.put("lazyFlippedByXmlScan", LazyInitXmlScanPostProcessor.flipped());
            out.put("handlerMethods", new java.util.ArrayList<>(handlers));
            out.put("autoconfigPositive", new java.util.ArrayList<>(positive));
            out.put("autoconfigNegative", new java.util.ArrayList<>(negative));
            out.put("autoconfigExclusions", new java.util.ArrayList<>(exclusions));
            out.put("autoconfigUnconditional", new java.util.ArrayList<>(unconditional));
            out.put("beans", defs);
            com.fasterxml.jackson.databind.ObjectMapper om = new com.fasterxml.jackson.databind.ObjectMapper();
            byte[] json = om.writerWithDefaultPrettyPrinter().writeValueAsBytes(out);
            Files.write(Paths.get(file), json, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING,
                    StandardOpenOption.WRITE);
        } catch (Throwable ignore) {
            // 测量 best-effort。
        }
    }

    private static long jvmUptimeMs() {
        return System.currentTimeMillis() - ManagementFactory.getRuntimeMXBean().getStartTime();
    }

    private static boolean envOff(String key) {
        String flag = System.getenv(key);
        return flag != null && ("0".equals(flag) || "false".equalsIgnoreCase(flag));
    }

    private static void selfWarmupAsync(ConfigurableApplicationContext ctx) {
        if (envOff("HOROSA_JAVA_SELF_WARMUP")) {
            return;
        }
        Thread warm = new Thread(() -> {
            try {
                // 让端口就绪轮询/首屏导航先行,热身贴在其后的空闲里。
                Thread.sleep(1500);
                long t0 = System.currentTimeMillis();
                // 八字全链(历法/JDN/节气/干支表)×3 组日期:类加载 + 常用路径 JIT。
                // 首个样本 = 「此刻」:应用打开时自动排的正是 now 盘,农历年表按 (year, zone) 首次组合
                // 重算最贵,固定年份样本预热不到本年 —— 用当前时刻把首盘要用的同一张年表先填上。
                String nowBirth = new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new java.util.Date());
                String[][] samples = {
                        {nowBirth, "+08:00", "121e28", "31n14"},
                        {"1984-02-04 10:30:00", "+08:00", "116e28", "39n54"},
                        {"2000-09-15 22:05:00", "+08:00", "121e28", "31n14"},
                        {"1976-07-06 21:11:00", "+08:00", "119e18", "26n05"},
                };
                for (String[] s : samples) {
                    OnlyFourColumns bz = new OnlyFourColumns(1, s[0], s[1], s[2], s[3], false, true);
                    bz.getNongli();
                }
                ledgerMark("java.self_warmup", System.currentTimeMillis() - t0);
            } catch (Throwable ignore) {
                // 热身 best-effort:失败静默,首点回到「冷即付」的现状语义。
            }
            prewarmLazyBeans(ctx);
        }, "horosa-self-warmup");
        warm.setDaemon(true);
        warm.setPriority(Thread.MIN_PRIORITY);
        warm.start();
    }

    /**
     * 把启动期被翻为 lazy 的 XML 扫描 bean 在后台逐个实例化(与首个真实请求的顺序无关:单例创建有容器锁,
     * 谁先到谁建,另一方直接拿现成的)。失败静默 —— 该 bean 回到「首次被用时才建」的既有语义。
     */
    private static void prewarmLazyBeans(ConfigurableApplicationContext ctx) {
        try {
            if (envOff("HOROSA_JAVA_LAZY_PREWARM")) {
                return;
            }
            List<String> names = LazyInitXmlScanPostProcessor.flipped();
            if (names.isEmpty() || ctx == null || !ctx.isActive()) {
                return;
            }
            long t0 = System.currentTimeMillis();
            int n = 0;
            StringBuilder failed = new StringBuilder();
            for (String name : names) {
                try {
                    if (!ctx.isActive()) {
                        break;
                    }
                    if (ctx.containsBean(name)) {
                        ctx.getBean(name);
                        n++;
                    }
                } catch (Throwable t) {
                    // 单个 bean 建不起来 = 与它首次被请求时的行为一致(那时同样抛),此处不放大;
                    // 但要留痕:延迟初始化后构造失败不再让启动失败,排障只能靠这里的记录。
                    if (failed.length() > 0) {
                        failed.append(',');
                    }
                    failed.append(name);
                    System.err.println("[horosa] lazy bean prewarm failed: " + name + " -> " + t);
                }
            }
            ledgerMarkNamed("java.lazy_prewarm", System.currentTimeMillis() - t0,
                    "beans=" + n + (failed.length() > 0 ? " failed=" + failed : ""));
        } catch (Throwable ignore) {
            // best-effort
        }
    }

    /** 供 main() 起跑前刻度使用(同一写入口,包内可见)。 */
    static void ledgerMarkNamedForMain(String seg, long ms, String name) {
        ledgerMarkNamed(seg, ms, name);
    }

    private static void ledgerMarkNamed(String seg, long ms, String name) {
        try {
            String ledgerFile = System.getenv("HOROSA_LEDGER_FILE");
            String enabled = System.getenv("HOROSA_STARTUP_LEDGER");
            if (ledgerFile == null || ledgerFile.isEmpty()) {
                return;
            }
            if (enabled != null && ("0".equals(enabled) || "false".equalsIgnoreCase(enabled))) {
                return;
            }
            String runTag = System.getenv("HOROSA_RUN_TAG");
            long pid = ManagementFactory.getRuntimeMXBean().getPid();
            String safeName = name == null ? "" : name.replace("\\", "\\\\").replace("\"", "\\\"");
            String row = String.format(
                    "{\"run\":\"%s\",\"layer\":\"java\",\"seg\":\"%s\",\"pid\":%d,\"ms\":%d,\"name\":\"%s\"}%n",
                    runTag == null ? "" : runTag.replace("\"", ""), seg, pid, ms, safeName);
            Path path = Paths.get(ledgerFile);
            Files.write(path, row.getBytes(StandardCharsets.UTF_8),
                    StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (Throwable ignore) {
            // 账本 best-effort。
        }
    }

    private static void ledgerMark(String seg, long ms) {
        try {
            String ledgerFile = System.getenv("HOROSA_LEDGER_FILE");
            String enabled = System.getenv("HOROSA_STARTUP_LEDGER");
            if (ledgerFile == null || ledgerFile.isEmpty()) {
                return;
            }
            if (enabled != null && ("0".equals(enabled) || "false".equalsIgnoreCase(enabled))) {
                return;
            }
            String runTag = System.getenv("HOROSA_RUN_TAG");
            long pid = ManagementFactory.getRuntimeMXBean().getPid();
            String row = String.format(
                    "{\"run\":\"%s\",\"layer\":\"java\",\"seg\":\"%s\",\"pid\":%d,\"ms\":%d}%n",
                    runTag == null ? "" : runTag.replace("\"", ""), seg, pid, ms);
            Path path = Paths.get(ledgerFile);
            Files.write(path, row.getBytes(StandardCharsets.UTF_8),
                    StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (Throwable ignore) {
            // 账本 best-effort:任何异常吞掉,绝不影响服务启动。
        }
    }
}
