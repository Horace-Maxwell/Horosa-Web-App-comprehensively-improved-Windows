// 紫微按盘临时覆盖在途时(盘面截图 / 挂载快照按这张盘的随盘设置出图),紫微页左栏首次构造按本机偏好同步引擎单例:
// 同步后在途覆盖仍压在单例上(截图不改按本机偏好出图),左栏显示本机偏好;覆盖还原后单例回到本机偏好。
const ZWConst = require('../../constants/ZWConst');
const { ZWEngineOptions } = require('../../components/ziwei/ziweiOptions');
const { applyZiweiRecordOverride } = require('../../components/ziwei/ZiWeiMain');
const ZiWeiInput = require('../../components/ziwei/ZiWeiInput').default;
const { __activeZiweiTempOverrideCountForTests, ZIWEI_TEMP_OVERRIDE_RESTORED_EVENT } = require('../../components/ziwei/ziweiTempOverrideScope');

const prev = { school: ZWConst.ZWSchool.school, huoling: ZWEngineOptions.huoling, span: ZWEngineOptions.daxianSpan };
afterEach(()=>{
	ZWConst.ZWSchool.school = prev.school; ZWConst.refreshActiveSiHua();
	ZWEngineOptions.huoling = prev.huoling; ZWEngineOptions.daxianSpan = prev.span;
	window.localStorage.clear();
});

describe('紫微临时覆盖在途时左栏构造', ()=>{
	test('覆盖仍生效、左栏显示本机偏好、还原后回到本机偏好', ()=>{
		// 进来时单例是旧值(还没有紫微左栏同步过偏好)
		ZWConst.ZWSchool.school = 'beipai';
		ZWEngineOptions.huoling = 'sanhe';
		window.localStorage.setItem('ziweiSihuaSchool', 'beixiang');
		window.localStorage.setItem('ziweiHuoling', 'zhongzhou');
		const restore = applyZiweiRecordOverride({ sihuaSchool: 'zhongzhou', huoling: 'quanshu' });
		expect(__activeZiweiTempOverrideCountForTests()).toBe(1);
		const page = new ZiWeiInput({ fields: {} });   // 紫微页左栏此刻首次构造
		// 截图要用的随盘设置仍在单例上
		expect(ZWConst.ZWSchool.school).toBe('zhongzhou');
		expect(ZWEngineOptions.huoling).toBe('quanshu');
		// 左栏显示本机偏好
		expect(page.state.sihuaSchool).toBe('beixiang');
		expect(page.state.huoling).toBe('zhongzhou');
		restore();
		expect(__activeZiweiTempOverrideCountForTests()).toBe(0);
		// 还原后回到刚同步的本机偏好(不是覆盖前的旧值)
		expect(ZWConst.ZWSchool.school).toBe('beixiang');
		expect(ZWEngineOptions.huoling).toBe('zhongzhou');
	});

	test('没有在途覆盖:左栏构造照旧按本机偏好同步(零回归)', ()=>{
		window.localStorage.setItem('ziweiSihuaSchool', 'quanshu');
		window.localStorage.setItem('ziweiHuoling', 'quanshu');
		const page = new ZiWeiInput({ fields: {} });
		expect(ZWConst.ZWSchool.school).toBe('quanshu');
		expect(ZWEngineOptions.huoling).toBe('quanshu');
		expect(page.state.huoling).toBe('quanshu');
	});
});

describe('覆盖在途期间紫微页首次挂载:还原后通知重排', ()=>{
	function listen(){
		const got = [];
		const fn = ()=>got.push(1);
		window.addEventListener(ZIWEI_TEMP_OVERRIDE_RESTORED_EVENT, fn);
		return { got, off: ()=>window.removeEventListener(ZIWEI_TEMP_OVERRIDE_RESTORED_EVENT, fn) };
	}

	test('期间有左栏构造(压回过覆盖):还原时广播一次', ()=>{
		window.localStorage.setItem('ziweiHuoling', 'zhongzhou');
		const l = listen();
		try{
			const restore = applyZiweiRecordOverride({ huoling: 'quanshu' });
			new ZiWeiInput({ fields: {} });
			expect(l.got.length).toBe(0);
			restore();
			expect(l.got.length).toBe(1);
			restore();   // 重复还原不再广播
			expect(l.got.length).toBe(1);
		}finally{ l.off(); }
	});

	test('期间没有页面挂载:还原不广播(零回归)', ()=>{
		const l = listen();
		try{
			const restore = applyZiweiRecordOverride({ huoling: 'quanshu' });
			restore();
			expect(l.got.length).toBe(0);
		}finally{ l.off(); }
	});

	test('紫微页收到广播按当前字段重排一次;卸载后不再响应', ()=>{
		const ZiWeiMain = require('../../components/ziwei/ZiWeiMain').default;
		const self = Object.create(ZiWeiMain.prototype);
		self.props = { fields: null };
		self.state = {};
		self.requestZiWei = jest.fn();
		self.handleSnapshotRefreshRequest = ()=>{};
		ZiWeiMain.prototype.componentDidMount.call(self);
		const fields = { date: { value: 'x' } };
		self.props = { fields };
		window.dispatchEvent(new CustomEvent(ZIWEI_TEMP_OVERRIDE_RESTORED_EVENT));
		expect(self.requestZiWei).toHaveBeenCalledTimes(1);
		expect(self.requestZiWei).toHaveBeenCalledWith(fields);
		ZiWeiMain.prototype.componentWillUnmount.call(self);
		window.dispatchEvent(new CustomEvent(ZIWEI_TEMP_OVERRIDE_RESTORED_EVENT));
		expect(self.requestZiWei).toHaveBeenCalledTimes(1);
	});
});
