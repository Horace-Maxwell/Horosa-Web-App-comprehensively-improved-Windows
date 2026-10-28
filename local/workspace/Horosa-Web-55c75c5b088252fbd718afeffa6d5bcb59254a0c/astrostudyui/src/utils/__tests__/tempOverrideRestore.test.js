// 临时覆盖的还原:紫微按盘临时覆盖(挂载快照 / 盘面截图共用)只还原「仍是自己临时值」的项;
// 七政覆盖作用域串行(两次交叠此前互相撤掉 / 复活对方的覆盖);盘面截图按记录构造字段、紫微按记录走临时覆盖。
const ZWConst = require('../../constants/ZWConst');
const { ZWEngineOptions } = require('../../components/ziwei/ziweiOptions');
const { applyZiweiRecordOverride } = require('../../components/ziwei/ZiWeiMain');

describe('紫微临时覆盖', ()=>{
	const prevSchool = ZWConst.ZWSchool.school;
	const prevSpan = ZWEngineOptions.daxianSpan;
	afterEach(()=>{ ZWConst.ZWSchool.school = prevSchool; ZWConst.refreshActiveSiHua(); ZWEngineOptions.daxianSpan = prevSpan; });

	test('覆盖期间生效,还原后回到进来时的值', ()=>{
		ZWConst.ZWSchool.school = 'beipai';
		const restore = applyZiweiRecordOverride({ sihuaSchool: 'zhongzhou', daxianSpan: 'ju' });
		expect(ZWConst.ZWSchool.school).toBe('zhongzhou');
		expect(ZWEngineOptions.daxianSpan).toBe('ju');
		restore();
		expect(ZWConst.ZWSchool.school).toBe('beipai');
		expect(ZWEngineOptions.daxianSpan).toBe(prevSpan);
		restore();   // 重复调用无副作用
		expect(ZWConst.ZWSchool.school).toBe('beipai');
	});

	test('🔴 覆盖期间用户亲手改了同一项:还原不拿旧值盖掉用户的新选择', ()=>{
		ZWConst.ZWSchool.school = 'beipai';
		const restore = applyZiweiRecordOverride({ sihuaSchool: 'zhongzhou', daxianSpan: 'ju' });
		ZWConst.ZWSchool.school = 'quanshu';    // 用户在紫微页改了流派
		ZWEngineOptions.daxianSpan = 10;
		restore();
		expect(ZWConst.ZWSchool.school).toBe('quanshu');
		expect(ZWEngineOptions.daxianSpan).toBe(10);
	});
});

describe('紫微临时覆盖与会话临时表', ()=>{
	test('🔴 覆盖槽里原有载入盘带来的临时表:按盘临时覆盖用完放回它,不清成空', ()=>{
		const sessionTable = ZWConst.normalizeSihuaCustomTable(JSON.stringify(ZWConst.SiHuaTables.zhongzhou));
		const prevSchool = ZWConst.ZWSchool.school;
		ZWConst.ZWSihuaCustom.override = sessionTable;
		ZWConst.ZWSchool.school = 'custom';
		try{
			const other = JSON.stringify({ ...ZWConst.SiHuaTables.beipai, 甲: ['廉贞', '破军', '武曲', '太阳'] });
			const restore = applyZiweiRecordOverride({ sihuaSchool: 'custom', sihuaCustomTable: other });
			expect(ZWConst.ZWSihuaCustom.override).not.toBe(sessionTable);
			restore();
			expect(ZWConst.ZWSihuaCustom.override).toBe(sessionTable);
		}finally{ ZWConst.ZWSihuaCustom.override = null; ZWConst.ZWSchool.school = prevSchool; ZWConst.refreshActiveSiHua(); }
	});
	test('🔴 紫微页登记引擎写入器时补上载入盘带来的临时表(页面没加载时先记着)', ()=>{
		const rs = require('../ziweiRecordSettings');
		const calls = [];
		rs.registerZiweiEngineAdapter(null);
		rs.applyZiweiRecordSettings({ cid: 'q', ziweiSettingsGen: 1, sihuaCustomTable: '{"丙":[]}' });
		rs.registerZiweiEngineAdapter({ write: ()=>{}, setSessionTable: (k, t)=>calls.push([k, t]) });
		expect(calls).toEqual([['sihua', '{"丙":[]}'], ['brightness', null]]);
		rs.clearZiweiSessionTables();
		rs.registerZiweiEngineAdapter(null);
	});
});

describe('七政覆盖作用域', ()=>{
	test('🔴 两次交叠:各自只看见自己的覆盖,结束后不残留', async ()=>{
		const style = require('../../components/guolao/GuoLaoChartStyle');
		let releaseA;
		const seen = [];
		const a = style.withGuolaoStoredOverrides({ k1: 'A' }, async ()=>{
			const scope = style.guolaoStoredOverridesScope();
			seen.push(['A-start', { ...(style.__guolaoStoredOverridesForTests() || {}) }]);
			await new Promise((r)=>{ releaseA = r; });
			// await 之后覆盖不再对全局可见,经作用域重入才看得见
			seen.push(['A-end', { ...(style.__guolaoStoredOverridesForTests() || {}) }]);
			style.runInGuolaoStoredOverrides(scope, ()=>{ seen.push(['A-reenter', { ...(style.__guolaoStoredOverridesForTests() || {}) }]); });
		});
		const b = style.withGuolaoStoredOverrides({ k2: 'B' }, async ()=>{
			seen.push(['B', { ...(style.__guolaoStoredOverridesForTests() || {}) }]);
		});
		await Promise.resolve(); await Promise.resolve();
		releaseA();
		await a; await b;
		expect(seen).toEqual([['A-start', { k1: 'A' }], ['A-end', {}], ['A-reenter', { k1: 'A' }], ['B', { k2: 'B' }]]);
		expect(style.__guolaoStoredOverridesForTests()).toBe(null);
	});
});

describe('盘面截图挂载', ()=>{
	test('🔴 字段按记录构造(八字长生 / 神煞查法合法、日界缺键 = 全局缺省);紫微截图期间按记录流派,卸载还原', ()=>{
		require('../../models/astro');
		const ChartCaptureMount = require('../../components/common/ChartCaptureMount').default;
		const rec = { cid: 'c1', name: '甲', birth: '1990-05-18 10:00:00', zone: '+08:00', lon: '121e28', lat: '31n14', gpsLat: 31.23, gpsLon: 121.47, gender: 1, phaseType: 1, sihuaSchool: 'zhongzhou' };
		const bz = new ChartCaptureMount({ chartType: 'bazi-fourColumns', caseRecord: rec });
		expect(bz.fields.phaseType.value).toBe(1);
		expect(['年', '日', '年日']).toContain(bz.fields.godKeyPos.value);
		const { defaultAfter23NewDay } = require('../dayBoundary');
		expect(bz.fields.after23NewDay.value).toBe(defaultAfter23NewDay());
		const prev = ZWConst.ZWSchool.school;
		ZWConst.ZWSchool.school = 'beipai';
		const zw = new ChartCaptureMount({ chartType: 'ziwei-12palace', caseRecord: rec });
		expect(ZWConst.ZWSchool.school).toBe('zhongzhou');
		zw.componentWillUnmount();
		expect(ZWConst.ZWSchool.school).toBe('beipai');
		ZWConst.ZWSchool.school = prev;
	});

	test('🔴 截图里的紫微左栏构造时不把随盘设置冲回本机偏好;独立页照常按本机偏好同步', ()=>{
		const ZiWeiInput = require('../../components/ziwei/ZiWeiInput').default;
		const { ZWEngineOptions } = require('../../components/ziwei/ziweiOptions');
		const prevSchool = ZWConst.ZWSchool.school;
		const prevHuoling = ZWEngineOptions.huoling;
		window.localStorage.setItem('ziweiSihuaSchool', 'beipai');
		window.localStorage.setItem('ziweiHuoling', 'sanhe');
		// 宿主已按这张盘临时覆盖:中州 + 全书火铃
		ZWConst.ZWSchool.school = 'zhongzhou';
		ZWEngineOptions.huoling = 'quanshu';
		const kept = new ZiWeiInput({ fields: {}, keepEngine: true });
		expect(ZWConst.ZWSchool.school).toBe('zhongzhou');
		expect(ZWEngineOptions.huoling).toBe('quanshu');
		expect(kept.state.sihuaSchool).toBe('zhongzhou');
		expect(kept.state.huoling).toBe('quanshu');
		// 独立页:按本机偏好同步单例
		const page = new ZiWeiInput({ fields: {} });
		expect(ZWConst.ZWSchool.school).toBe('beipai');
		expect(ZWEngineOptions.huoling).toBe('sanhe');
		expect(page.state.sihuaSchool).toBe('beipai');
		ZWConst.ZWSchool.school = prevSchool;
		ZWEngineOptions.huoling = prevHuoling;
		window.localStorage.clear();
	});

	test('截图挂载把「宿主管着单例」交给紫微页(有随盘覆盖时)', ()=>{
		const ChartCaptureMount = require('../../components/common/ChartCaptureMount').default;
		const ZiWeiMain = require('../../components/ziwei/ZiWeiMain').default;
		const find = (node, out)=>{
			if(!node || typeof node !== 'object'){ return out; }
			if(Array.isArray(node)){ node.forEach((n)=>find(n, out)); return out; }
			if(node.type === ZiWeiMain){ out.push(node.props); }
			if(node.props && node.props.children){ find(node.props.children, out); }
			return out;
		};
		const rec = { cid: 'c1', name: '甲', birth: '1990-05-18 10:00:00', zone: '+08:00', lon: '121e28', lat: '31n14', gpsLat: 31.23, gpsLon: 121.47, gender: 1, sihuaSchool: 'zhongzhou' };
		const prev = ZWConst.ZWSchool.school;
		const zw = new ChartCaptureMount({ chartType: 'ziwei-12palace', caseRecord: rec });
		const props = find(zw.renderInner(), []);
		expect(props.length).toBe(1);
		expect(props[0].engineManagedByHost).toBe(true);
		zw.componentWillUnmount();
		ZWConst.ZWSchool.school = prev;
	});
});
