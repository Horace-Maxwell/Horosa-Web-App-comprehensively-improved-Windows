import fs from 'fs';
import path from 'path';
import * as AstroConst from '../../../constants/AstroConst';
import AstroChart from '../AstroChart';
import AstroWheelArtChart, {
	getArtCuspParts,
	signNumberForHouse,
	withAngles,
	MEDIEVAL_HOUSE_POLYGONS,
	MEDIEVAL_HOUSE_LABEL_POSITIONS,
	MEDIEVAL_SIGN_BADGE_POSITIONS,
	MEDIEVAL_OBJECT_ANCHOR_POSITIONS,
} from '../AstroWheelArtChart';

// 盘面美术(wheel art)金标:五档归一 / 中世纪几何(骑线徽章·质心锚·零压线) / 全链接线锁 / 持久化白名单。
// 中世纪排版是用户逐点校准的规格 —— 徽章=宫头分宫线中点、宫号贴内方形、星体=三角质心,坐标表变更必须过本套断言。

const SRC_ROOT = path.resolve(__dirname, '../../..');
const read = (rel)=>fs.readFileSync(path.join(SRC_ROOT, rel), 'utf8');

describe('wheelArt 五档常量与归一', ()=>{
	it('五档值恒等,缺省/野值恒兜 classic(不传参调用方零漂移)', ()=>{
		expect(AstroConst.WHEEL_ART_OPTIONS.map((o)=>o.value)).toEqual([
			'classic', 'hellenistic', 'medieval', 'northIndian', 'southIndian',
		]);
		AstroConst.WHEEL_ART_OPTIONS.forEach((o)=>{
			expect(AstroConst.normalizeWheelArt(o.value)).toBe(o.value);
		});
		expect(AstroConst.normalizeWheelArt(undefined)).toBe(AstroConst.WHEEL_ART_CLASSIC);
		expect(AstroConst.normalizeWheelArt(null)).toBe(AstroConst.WHEEL_ART_CLASSIC);
		expect(AstroConst.normalizeWheelArt('bogus')).toBe(AstroConst.WHEEL_ART_CLASSIC);
	});

	it('五档中文标签与用户命名一致', ()=>{
		expect(AstroConst.WHEEL_ART_OPTIONS.map((o)=>o.label)).toEqual([
			'经典圆盘', '希腊盘', '中世纪盘', '北印度盘', '南印度盘',
		]);
	});
});

describe('覆盘槽位算术与角点并入', ()=>{
	it('signNumberForHouse:AS 星座=1 宫,逆时针推续', ()=>{
		expect(signNumberForHouse(1, 3)).toBe(3);
		expect(signNumberForHouse(2, 3)).toBe(4);
		expect(signNumberForHouse(12, 3)).toBe(2);
		expect(signNumberForHouse(10, 3)).toBe(12);
	});

	it('withAngles:Asc/MC 恒并入显示集(角点是盘骨架);空集(全隐)与漏传不动', ()=>{
		expect(withAngles(['Sun'])).toEqual(['Sun', AstroConst.ASC, AstroConst.MC]);
		expect(withAngles(['Sun', AstroConst.ASC])).toEqual(['Sun', AstroConst.ASC, AstroConst.MC]);
		expect(withAngles([])).toEqual([]);
		expect(withAngles(undefined)).toBe(undefined);
	});

	it('getArtCuspParts:象限宫头标度分;整宫 0°00′ 不标;缺宫返回 null', ()=>{
		const chartObj = { chart: { houses: [
			{ id: 'House1', lon: 135.7 },
			{ id: 'House2', lon: 150 },
		] } };
		const h1 = getArtCuspParts(chartObj, 1);
		expect(h1.deg).toBe('15°');
		expect(h1.min).toBe('42′');
		expect(getArtCuspParts(chartObj, 2)).toBe(null);
		expect(getArtCuspParts(chartObj, 3)).toBe(null);
	});
});

describe('中世纪盘几何(用户校准规格,坐标表=金标)', ()=>{
	const parsePoly = (str)=>str.split(' ').map((p)=>p.split(',').map(Number));
	const centroid = (pts)=>[
		pts.reduce((s, p)=>s + p[0], 0) / pts.length,
		pts.reduce((s, p)=>s + p[1], 0) / pts.length,
	];
	// 射线法点在多边形内(含边界收缩 eps 判定用途:锚点必须真在三角内)。
	const inPoly = (pt, pts)=>{
		let inside = false;
		for(let i = 0, j = pts.length - 1; i < pts.length; j = i++){
			const [xi, yi] = pts[i];
			const [xj, yj] = pts[j];
			if(((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi)){
				inside = !inside;
			}
		}
		return inside;
	};

	it('12 三角覆满且互不重叠(面积和=外方形-内方形=7500)', ()=>{
		const area = (pts)=>Math.abs(pts.reduce((s, p, i)=>{
			const q = pts[(i + 1) % pts.length];
			return s + (p[0] * q[1] - q[0] * p[1]);
		}, 0)) / 2;
		const total = Object.values(MEDIEVAL_HOUSE_POLYGONS).reduce((s, str)=>s + area(parsePoly(str)), 0);
		expect(total).toBeCloseTo(7500, 5);
	});

	it('星座徽章恒骑「该宫宫头分宫线」中点(用户标注定版:1 宫=(12.5,37.5)、2 宫=(12.5,62.5)、7 宫=(87.5,62.5))', ()=>{
		// 宫头线:宫 n 与宫 n-1 的界线 = 两三角共享边;徽章位置=该边中点。
		const shared = (a, b)=>{
			const pa = parsePoly(MEDIEVAL_HOUSE_POLYGONS[a]);
			const pb = parsePoly(MEDIEVAL_HOUSE_POLYGONS[b]);
			const key = (p)=>`${p[0]},${p[1]}`;
			const setB = new Set(pb.map(key));
			return pa.filter((p)=>setB.has(key(p)));
		};
		for(let h = 1; h <= 12; h++){
			const prev = h === 1 ? 12 : h - 1;
			const edge = shared(h, prev);
			expect(edge.length).toBe(2);
			const mid = [(edge[0][0] + edge[1][0]) / 2, (edge[0][1] + edge[1][1]) / 2];
			expect(MEDIEVAL_SIGN_BADGE_POSITIONS[h]).toEqual(mid);
		}
		expect(MEDIEVAL_SIGN_BADGE_POSITIONS[1]).toEqual([12.5, 37.5]);
		expect(MEDIEVAL_SIGN_BADGE_POSITIONS[2]).toEqual([12.5, 62.5]);
		expect(MEDIEVAL_SIGN_BADGE_POSITIONS[7]).toEqual([87.5, 62.5]);
	});

	it('星体锚盒中心=三角质心(±0.5)且盒体四角不越出所在三角(用户定版:星体放三角中心)', ()=>{
		for(let h = 1; h <= 12; h++){
			const pts = parsePoly(MEDIEVAL_HOUSE_POLYGONS[h]);
			const c = centroid(pts);
			const [x, y, w, hh] = MEDIEVAL_OBJECT_ANCHOR_POSITIONS[h];
			expect(Math.abs(x - c[0])).toBeLessThanOrEqual(0.5);
			expect(Math.abs(y - c[1])).toBeLessThanOrEqual(0.5);
			[[x - w / 2, y - hh / 2], [x + w / 2, y - hh / 2], [x - w / 2, y + hh / 2], [x + w / 2, y + hh / 2]].forEach((corner)=>{
				expect(inPoly(corner, pts)).toBe(true);
			});
		}
	});

	it('宫号贴内方形(强宫=四边中点外侧 2.5;角宫成对贴四角)且在各自三角内', ()=>{
		expect(MEDIEVAL_HOUSE_LABEL_POSITIONS[1]).toEqual([22.5, 50]);
		expect(MEDIEVAL_HOUSE_LABEL_POSITIONS[4]).toEqual([50, 77.5]);
		expect(MEDIEVAL_HOUSE_LABEL_POSITIONS[7]).toEqual([77.5, 50]);
		expect(MEDIEVAL_HOUSE_LABEL_POSITIONS[10]).toEqual([50, 22.5]);
		for(let h = 1; h <= 12; h++){
			const pts = parsePoly(MEDIEVAL_HOUSE_POLYGONS[h]);
			expect(inPoly(MEDIEVAL_HOUSE_LABEL_POSITIONS[h], pts)).toBe(true);
		}
	});

	it('宫号/徽章/星体锚三类框两两零重叠(全 12 槽)', ()=>{
		const boxes = [];
		for(let h = 1; h <= 12; h++){
			const [lx, ly] = MEDIEVAL_HOUSE_LABEL_POSITIONS[h];
			boxes.push({ kind: `label${h}`, x1: lx - 1.5, y1: ly - 1.5, x2: lx + 1.5, y2: ly + 1.5 });
			const [sx, sy] = MEDIEVAL_SIGN_BADGE_POSITIONS[h];
			boxes.push({ kind: `sign${h}`, x1: sx - 6, y1: sy - 2, x2: sx + 6, y2: sy + 2 });
			const [ax, ay, aw, ah] = MEDIEVAL_OBJECT_ANCHOR_POSITIONS[h];
			boxes.push({ kind: `anchor${h}`, x1: ax - aw / 2, y1: ay - ah / 2, x2: ax + aw / 2, y2: ay + ah / 2 });
		}
		for(let i = 0; i < boxes.length; i++){
			for(let j = i + 1; j < boxes.length; j++){
				const a = boxes[i];
				const b = boxes[j];
				const overlap = a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
				expect(overlap ? `${a.kind}×${b.kind}` : '').toBe('');
			}
		}
	});
});

describe('全链接线锁(L2 静态)', ()=>{
	it('AstroChart:wheelArt 进 sCU 白名单 + render 非 classic 切方盘 + drawChart 方盘期休眠', ()=>{
		const src = read('components/astro/AstroChart.js');
		expect(/ASTROCHART_SCU_KEYS\s*=\s*\[[^\]]*'wheelArt'/s.test(src)).toBe(true);
		expect(src.includes('AstroWheelArtChart')).toBe(true);
		expect(src.includes('normalizeWheelArt(this.props.wheelArt)')).toBe(true);
	});

	it('AstroChart 实例:wheelArt 变化必触发重渲染(sCU true)', ()=>{
		const c = new AstroChart({ value: { chart: {} }, chartStyle: 'current', wheelArt: 'classic', id: 'natal' });
		expect(c.shouldComponentUpdate({ ...c.props, wheelArt: 'medieval' }, c.state)).toBe(true);
	});

	it('AstroChartMain:双下拉单源 renderWheelStyleGrid 在卡片与浮层两入口 + changeWheelArt 走 app/save', ()=>{
		const src = read('components/astro/AstroChartMain.js');
		expect((src.match(/this\.renderWheelStyleGrid\(chartStyle\)/g) || []).length).toBe(2);
		expect(src.includes('changeWheelArt')).toBe(true);
		expect(/changeWheelArt[\s\S]{0,200}app\/save/.test(src)).toBe(true);
		expect(/AstroChart[^/]*[\s\S]{0,400}wheelArt=\{this\.props\.wheelArt\}/.test(src)).toBe(true);
	});

	it('pages/index:app 解构含 wheelArt 且四个壳全部透传', ()=>{
		const src = read('pages/index.js');
		expect(/chartDisplay, chartStyle, wheelArt, indiaChartStyle/.test(src)).toBe(true);
		expect((src.match(/wheelArt=\{wheelArt\}/g) || []).length).toBeGreaterThanOrEqual(5);
	});

	it('app model:state 初值 / save 归一 / globalSetup 白名单三处齐备(漏白名单=静默不存)', ()=>{
		const src = read('models/app.js');
		expect(/wheelArt:\s*AstroConst\.WHEEL_ART_CLASSIC/.test(src)).toBe(true);
		expect(/payload\.wheelArt\s*=\s*AstroConst\.normalizeWheelArt/.test(src)).toBe(true);
		expect(/wheelArt:\s*st\.wheelArt/.test(src)).toBe(true);
		expect(/normalized\.wheelArt\s*=\s*AstroConst\.normalizeWheelArt/.test(src)).toBe(true);
	});

	it('样式跟随组件(合盘/希腊/辅盘/节气/朔望)逐一透传 wheelArt', ()=>{
		[
			'components/astro/AstroPrenatalSyzygy.js',
			'components/auxchart/AstroRelocationLab.js',
			'components/auxchart/AstroHarmonicLab.js',
			'components/auxchart/AstroDraconicLab.js',
			'components/relative/AstroComposite.js',
			'components/relative/AstroTimeSpace.js',
			'components/relative/AstroMarks.js',
			'components/relative/AstroSynastry.js',
			'components/hellenastro/HellenAstroMain.js',
			'components/hellenastro/AstroChart13.js',
			'components/hellenastro/Dwadasamsa12Main.js',
			'components/jieqi/JieQiChartsMain.js',
		].forEach((rel)=>{
			expect(`${rel}:${read(rel).includes('wheelArt={this.props.wheelArt}')}`).toBe(`${rel}:true`);
		});
	});

	it('DivinationChartShell:本地 wheelArt 读写 globalSetup + 透传 + 双下拉', ()=>{
		const src = read('components/divination/DivinationChartShell.js');
		expect(src.includes('readStoredWheelArt')).toBe(true);
		expect(src.includes('writeStoredWheelArt')).toBe(true);
		expect(src.includes('wheelArt={this.state.wheelArt}')).toBe(true);
		expect(src.includes('changeWheelArt')).toBe(true);
	});

	it('ChartDisplaySelector(星盘设置):盘面美术下拉写 app/save', ()=>{
		const src = read('components/astro/ChartDisplaySelector.js');
		expect(/盘面美术[\s\S]{0,600}WHEEL_ART_OPTIONS/.test(src)).toBe(true);
		expect(/盘面美术[\s\S]{0,600}app\/save/.test(src)).toBe(true);
	});
});

describe('wheelArt 传链完备性总锁(机械扫描,新增消费点必须显式表态)', ()=>{
	const glob = (dir, acc)=>{
		fs.readdirSync(dir, { withFileTypes: true }).forEach((ent)=>{
			if(ent.name === '__tests__' || ent.name === 'node_modules'){
				return;
			}
			const full = path.join(dir, ent.name);
			if(ent.isDirectory()){
				glob(full, acc);
			}else if(ent.name.endsWith('.js')){
				acc.push(full);
			}
		});
		return acc;
	};

	// 豁免名单(成文决策,新增豁免必须在此登记并写明理由):
	// - AstroZR:黄道释放专用盘,chartStyle 硬编经典圆盘、zrHighlightSign 高亮语义依赖圆盘 → 恒 classic。
	const CONSUMER_EXEMPT = new Set([
		'components/astro/AstroZR.js',
	]);

	// horosa_win_pathsep_posix_v1(Windows 侧移植适配;建议上游化):
	// `path.relative` 在 Windows 返回反斜杠分隔(`components\astro\AstroZR.js`),
	// 而 CONSUMER_EXEMPT 的键是 POSIX 写法 ⇒ 键查不中 ⇒ **成文豁免失效**,
	// AstroZR 被误报成违规(macOS 上恒绿,只在 Windows 假红)。统一归一为 POSIX 再查。
	// 仓内同类先例:chartFreeContract / quickDockContract / heavyEngineImportGraph 三个契约测试同 marker。
	const relPosix = (from, to) => path.relative(from, to).split(path.sep).join('/');

	it('每个 <AstroChart 渲染点:要么带 wheelArt= 要么在成文豁免名单', ()=>{
		const offenders = [];
		glob(path.join(SRC_ROOT, 'components'), []).forEach((full)=>{
			const rel = relPosix(SRC_ROOT, full);
			const src = fs.readFileSync(full, 'utf8');
			let idx = 0;
			for(;;){
				const at = src.indexOf('<AstroChart ', idx);
				const at2 = src.indexOf('<AstroChart\n', idx);
				const hit = at >= 0 && (at2 < 0 || at < at2) ? at : at2;
				if(hit < 0){
					break;
				}
				const seg = src.slice(hit, src.indexOf('/>', hit) + 2 || hit + 800);
				if(!seg.includes('wheelArt=') && !CONSUMER_EXEMPT.has(rel)){
					offenders.push(rel);
				}
				idx = hit + 12;
			}
		});
		expect(offenders).toEqual([]);
	});

	// sCU 放行锁:凡传/消费 wheelArt 且用 shallowPropsEqual(白名单) 做 sCU 的组件,白名单必须含 'wheelArt' ——
	// 否则改档在该层被拦截、子树冻结(2026-08-09 量化盘实报:MIDPOINTMAIN_SCU_KEYS 漏登)。
	// wrapperPropsEqual(this.props, nextProps) 全键比较天然放行,不在此列。
	it('每个带 wheelArt 的组件:白名单型 sCU 必含 wheelArt 键', ()=>{
		const offenders = [];
		glob(path.join(SRC_ROOT, 'components'), []).forEach((full)=>{
			const src = fs.readFileSync(full, 'utf8');
			if(!src.includes('wheelArt={this.props.wheelArt}') && !src.includes('wheelArt: this.props.wheelArt')){
				return;
			}
			const m = src.match(/const\s+\w*_SCU_KEYS\s*=\s*\[([\s\S]*?)\]/);
			if(m && !m[1].includes("'wheelArt'")){
				offenders.push(relPosix(SRC_ROOT, full));
			}
		});
		expect(offenders).toEqual([]);
	});

	// 宿主链断点锁:组件内写了 wheelArt={this.props.wheelArt} 的,其宿主渲染点必须真的传 wheelArt —— 否则
	// props 恒 undefined=恒圆盘死开关(2026-08-09 十三分盘实报:AuxChartMain 没传,子组件白接)。
	// chartRenderer 注入型(AstroChartMain 回调)与 DivinationChartShell(state 自理)不在此列。
	it('每个消费 this.props.wheelArt 的组件:至少一个宿主渲染点传了 wheelArt', ()=>{
		const all = glob(path.join(SRC_ROOT, 'components'), []).concat([path.join(SRC_ROOT, 'pages/index.js')]);
		const srcByFile = new Map(all.map((f)=>[f, fs.readFileSync(f, 'utf8')]));
		const consumers = [];
		srcByFile.forEach((src, full)=>{
			if(src.includes('wheelArt={this.props.wheelArt}')){
				consumers.push(path.basename(full, '.js'));
			}
		});
		const broken = [];
		consumers.forEach((name)=>{
			if(name === 'AstroChart' || name === 'AstroWheelArtChart'){
				return;
			}
			let wired = false;
			let rendered = false;
			srcByFile.forEach((src)=>{
				let idx = 0;
				for(;;){
					const hit = src.indexOf(`<${name}`, idx);
					if(hit < 0){
						break;
					}
					const after = src.charAt(hit + name.length + 1);
					if(after === ' ' || after === '\n' || after === '\t' || after === '>'){
						rendered = true;
						const seg = src.slice(hit, hit + 1600);
						if(seg.includes('wheelArt=')){
							wired = true;
						}
					}
					idx = hit + name.length + 1;
				}
			});
			if(rendered && !wired){
				broken.push(name);
			}
		});
		expect(broken).toEqual([]);
	});
});

describe('渲染冒烟(类实例直测)', ()=>{
	const westChart = ()=>({
		chart: {
			objects: [
				{ id: 'Sun', lon: 45.5, sign: 'Taurus', signlon: 15.5, lonspeed: 1 },
				{ id: 'Moon', lon: 132, sign: 'Leo', signlon: 12, lonspeed: 13 },
				{ id: 'Asc', lon: 135.7, sign: 'Leo', signlon: 15.7 },
				{ id: 'MC', lon: 37.1, sign: 'Taurus', signlon: 7.1 },
			],
			houses: [
				{ id: 'House1', lon: 135.7 },
				{ id: 'House10', lon: 37.1 },
			],
		},
		lots: [],
	});

	it('四种美术盘 render 均产出盘板且行星按星座正确入格', ()=>{
		[
			AstroConst.WHEEL_ART_HELLENISTIC,
			AstroConst.WHEEL_ART_MEDIEVAL,
			AstroConst.WHEEL_ART_NORTH_INDIAN,
			AstroConst.WHEEL_ART_SOUTH_INDIAN,
		].forEach((art)=>{
			const c = new AstroWheelArtChart({ value: westChart(), wheelArt: art, planetDisplay: ['Sun', 'Moon'], lotsDisplay: [] });
			const tree = c.render();
			expect(`${art}:${!!tree}`).toBe(`${art}:true`);
			const json = JSON.stringify(tree);
			// AS 在狮子=1 宫;Sun 在金牛(10 宫,狮子起数):两者都必须被渲染出来(withAngles 并入 Asc/MC)。
			expect(json.includes('15°42′')).toBe(true);
			expect(json.includes('15°30′')).toBe(true);
		});
	});

	it('classic 档 AstroChart.render 仍返回 <svg>(既有圆盘管线零变化)', ()=>{
		const c = new AstroChart({ value: westChart(), wheelArt: 'classic', id: 'natal' });
		const tree = c.render();
		expect(tree.type).toBe('svg');
	});

	it('非 classic 档 AstroChart.render 切换为方盘组件', ()=>{
		const c = new AstroChart({ value: westChart(), wheelArt: 'southIndian', id: 'natal' });
		const tree = c.render();
		expect(tree.type).toBe(AstroWheelArtChart);
	});
});
