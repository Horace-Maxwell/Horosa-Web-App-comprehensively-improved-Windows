// 本机排盘服务根的单一来源:resolveChartServiceRoot 每次现算(覆盖根运行中才协商出来,模块加载时冻结就跟不上);
// 优先级 = 启动 URL 显式参数 > 覆盖根 > ServerRoot 的 :9999→:8899;源码里不许再各写一份「:9999 → 别的口」的根解析
import fs from 'fs';
import path from 'path';
import { resolveChartServiceRoot, resolveKentangServiceRoot, setKentangRootOverride } from '../../integrations/kentang/serviceRoot';

const SRC = path.resolve(__dirname, '../..');

describe('本机排盘服务根单源', ()=>{
	afterEach(()=>{ window.history.replaceState(null, '', '/'); });
	test('覆盖根写入之后,下一次调用立刻跟上(不冻结)', ()=>{
		const before = resolveChartServiceRoot([]);
		setKentangRootOverride('http://127.0.0.1:18899');
		expect(resolveChartServiceRoot([])).toBe('http://127.0.0.1:18899');
		expect(resolveKentangServiceRoot('qimen')).toBe('http://127.0.0.1:18899');
		expect(before).not.toBe('http://127.0.0.1:18899');
	});
	test('启动 URL 的显式参数优先于覆盖根;调用方的键排在通用键前面', ()=>{
		setKentangRootOverride('http://127.0.0.1:18899');
		window.history.replaceState(null, '', '/?chartSrv=http://127.0.0.1:7001&pageSrv=http://127.0.0.1:7002');
		expect(resolveChartServiceRoot([])).toBe('http://127.0.0.1:7001');
		expect(resolveChartServiceRoot(['pageSrv'])).toBe('http://127.0.0.1:7002');
		window.history.replaceState(null, '', '/?pageSrv=not-a-url');
		expect(resolveChartServiceRoot(['pageSrv'])).toBe('http://127.0.0.1:18899');
	});
	test('源码里「:9999 → 别的口」的根解析只许在单源文件里(登记的旧端口兜底候选除外)', ()=>{
		const ALLOW = {
			'integrations/kentang/serviceRoot.js': '单源本身',
			'components/wuzhao/WuZhaoMain.js': '首跳走 buildKentangEndpoint;其后是旧端口兜底候选',
		};
		const hits = [];
		const walk = (dir)=>{
			fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
				const p = path.join(dir, e.name);
				if(e.isDirectory()){ if(e.name !== '__tests__' && e.name !== 'node_modules'){ walk(p); } return; }
				if(!/\.(js|jsx|ts|tsx)$/.test(e.name)){ return; }
				const rel = path.relative(SRC, p).split(path.sep).join('/');
				const text = fs.readFileSync(p, 'utf8');
				if(/:9999\(\?:\\\/\)\?\$\/i\.test\(ServerRoot\)/.test(text) && !ALLOW[rel]){ hits.push(rel); }
			});
		};
		walk(SRC);
		expect(hits).toEqual([]);
		Object.keys(ALLOW).forEach((rel)=>expect(fs.existsSync(path.join(SRC, rel))).toBe(true));
	});
});
