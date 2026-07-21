const buildForFile = process.env.BUILD_FOR_FILE === '1';

export default {
	publicPath: buildForFile ? './' : '/static/',
	outputPath: buildForFile ? 'dist-file' : 'dist',
	history: buildForFile ? { type: 'hash' } : undefined,
	hash: true,
	dva: {
		immer: false,
	},
	antd: {},
	dynamicImport: {},
	// 性能分包:多个技法路由 chunk 曾各自内联同一批重依赖(three/lunar/kinastro 等被双份
	// 打进 5.7MB+4.8MB 两个 chunk,双份下载双份解析)。把 ≥2 处引用的重库/重源码提成命名
	// async vendor chunk;moment 裁掉未用 locale(zh-cn 在 layouts 显式 import 完整路径,
	// 不受 IgnorePlugin 的 context 匹配影响,保留)。回退=注释本段(kill-switch)。
	chainWebpack(config, { webpack }) {
		config.merge({
			optimization: {
				splitChunks: {
					chunks: 'async',
					minSize: 30000,
					maxInitialRequests: 12,
					// WS-N1(2026-07-16):16 → 40。16 时恰好顶格:两个最大页面根(46/47 chunk)的
					// Promise.all 恰 16 项,共享的 9-10 个独立 chunk 文件在场却因请求预算引用不了,
					// 内容被【回灌】进两根各存一份(94 共有模块/重复 2.48MB,dist 白胖 ~5MB)。
					// 首试 30 仍被用满(p__index 组=30 顶格,check-chunk-dup 哨兵实咬)→ 40 留余量。
					// 2026-07-19:40 再顶格(P5 懒化把 CnYiBu 子技法/AstroRelative/ChartMemo 全转
					// async,p__index 组=40 == 上限,哨兵咬)→ 56 续留余量,同判据同回退。
					// 判据:任何组的 Promise.all 长度 == 本值即再次顶格(scripts/check-chunk-dup.js
					// 哨兵盯)。请求数多 = 桌面本地协议零成本/web 静态托管可并发,回灌才是真税。
					// 回退 kill-switch:HOROSA_SPLIT_MAXREQ=16。
					maxAsyncRequests: Number(process.env.HOROSA_SPLIT_MAXREQ || 56),
					cacheGroups: {
						vendorsGl: {
							name: 'vendors-gl',
							test: /[\\/]node_modules[\\/](three|astronomy-engine)[\\/]/,
							chunks: 'async',
							priority: 30,
							minChunks: 2,
							reuseExistingChunk: true,
						},
						// WS-N5:minChunks 2→1。echarts 现仅玄学史一个 async 消费者,minChunks:2 恒
						// 不命中 → 内容匿名内联在数字 id chunk(66),增删 chunk 时数字 id 重排 = hash
						// 全变,更新包/HTTP 缓存被无谓击穿。1 = 收编为稳定命名 vendors-viz(字节不变,
						// 只换名);未来出现第二消费者语义依旧正确。
						vendorsViz: {
							name: 'vendors-viz',
							test: /[\\/]node_modules[\\/](echarts|zrender|d3|d3-[^\\/]+|@antv)[\\/]/,
							chunks: 'async',
							priority: 28,
							minChunks: 1,
							reuseExistingChunk: true,
						},
						// (WS-N5)原 vendorsCalendar 规则已删:lunar-javascript/sxtwl 被 eager 八字带进
						// p__index/vendors~p__index(有意),async 子 chunk 因父可用性优化不再含它 →
						// 规则永不命中,是死配置(2026-07-16 dist 逆向证实,勿凭它推断 calendar 已提取)。
						// 神数正传:引擎 + 秘数表(~250KB)。其文件在 src/utils/ 下 → 会被 sharedTechnique 的
						// test 命中,且被组件 chunk 与挂载 builder 两处引用即满足 minChunks:2 → 遭提取进
						// shared-technique(全技法共载)。此处以更高 priority 的窄规则截下,令其只随本技法走。
						// 条文库另有 magic comment 的 zhengchuan-verses-* chunk,不受此规则影响。
						zhengchuanEngine: {
							name: 'zhengchuan-engine',
							test: /[\\/]src[\\/]utils[\\/](zhengchuan[A-Za-z]+\.js|data[\\/]zhengchuan(?!.*Verses)[A-Za-z]+\.json)$/,
							chunks: 'async',
							priority: 24,
							minChunks: 1,
							reuseExistingChunk: true,
						},
						sharedTechnique: {
							name: 'shared-technique',
							test: /[\\/]src[\\/](components[\\/](kinastro|comp|xq-ui)|utils|data|constants)[\\/]/,
							chunks: 'async',
							priority: 20,
							minChunks: 2,
							minSize: 60000,
							reuseExistingChunk: true,
						},
					},
				},
			},
		});
		// 只保留 zh-cn(IgnorePlugin 在本 webpack 版本会连显式 import 的 zh-cn 一起裁掉,
		// 实测破坏中文日期 → 改用 ContextReplacement 精确白名单)
		config.plugin('moment-locale-trim')
			.use(webpack.ContextReplacementPlugin, [/moment[\\/]locale$/, /zh-cn/]);
	},
	dll: false,
	hardSource: false,
	pwa: false,
	hd: false,
	fastClick: false,
	title: '星阙 - 玄学与星座云平台',
}
