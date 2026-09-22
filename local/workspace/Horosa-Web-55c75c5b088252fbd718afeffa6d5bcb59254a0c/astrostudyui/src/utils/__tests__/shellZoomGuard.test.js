// 壳缩放链守卫:主限天球「时间轴被滚上去/底部露白」四层病理的防复发锁。
// 病理:①layouts 内联 100vh 与 clientHeight 域劈叉(缩放≠1 时差出可平移空间)
// ②direction 页 tabs 内容链无定高(子组件 maxHeight:100% 因包含块 auto 视作 none)
// ③时间轴 pointer capture 期 pointerleave 释放=WebKit autoscroll 复活
// ④缩放注入走 localStorage 跨 origin 断链(URL query 才是确定性通道)。
import fs from 'fs';
import path from 'path';
import { getShellZoom, getLayoutViewportHeight, resolveBootstrapZoom, SHELL_ZOOM_STORAGE_KEY } from '../shellZoom';
import { __resetScaleCacheForTest } from '../zoomDomain';

const SRC = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

describe('壳缩放链守卫', () => {
	afterEach(() => {
		try{ window.localStorage.removeItem(SHELL_ZOOM_STORAGE_KEY); }catch(e){ /* ignore */ }
	});

	it('①layouts/app.js 禁 100vh 内联(域劈叉源头;剥注释后断言,注释里的告诫不算)', () => {
		const t = read('layouts/app.js').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
		expect(t.includes('100vh')).toBe(false);
	});

	it('②app.less direction 页 tabs 内容链定高规则在位', () => {
		const t = read('layouts/app.less');
		expect(/\.horosa-direction-page\s*>\s*\.ant-tabs\s*>\s*\.ant-tabs-content-holder\s*>\s*\.ant-tabs-content/.test(t)).toBe(true);
	});

	it('③AstroPDSphere 捕获期忽略 pointerleave + guard 对偶分支在位', () => {
		const sphere = read('components/astro3d/AstroPDSphere.js');
		expect(sphere.includes('handleTimelineLeave')).toBe(true);
		expect(/handleTimelineLeave\(\)\s*\{[^}]*_tlCaptured[^}]*return;/s.test(sphere)).toBe(true);
		const direct = read('components/direction/AstroDirectMain.js');
		expect(direct.includes('this.rootEl.contains(t)')).toBe(true);
	});

	it('④启动档位单源:global.js 只经 readBootstrapShellZoom 取启动值;双源(URL query / 键)读法集中在 shellZoom.js', () => {
		const strip = (x) => x.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
		const g = strip(read('global.js'));
		expect(g.includes('readBootstrapShellZoom')).toBe(true);
		expect(g.includes('shellZoom=')).toBe(false);                 // global.js 不再自带一份读法(两份读法 = 漂移源)
		const z = strip(read('utils/shellZoom.js'));
		expect(z.includes('shellZoom=')).toBe(true);
		expect(z.includes('localStorage.getItem(KEY)')).toBe(true);
	});

	// 🔴 运行期真值只认 inline zoom:zoomDomain 不得再 import 启动传输层(剥注释后断言)。
	it('⑤zoomDomain 与启动传输层解耦:不 import shellZoom、getDeclaredZoom 不读 query/键', () => {
		const t = read('utils/zoomDomain.js').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
		expect(/from\s+['"]\.\/shellZoom['"]/.test(t)).toBe(false);
		expect(t.includes('getShellZoom')).toBe(false);
		expect(t.includes('location.search')).toBe(false);
	});

	it('resolveBootstrapZoom 真值表:壳导航以 query 为准;页面自刷新以键为准(URL 还是启动旧 query);非法值拒收', () => {
		expect(resolveBootstrapZoom({})).toEqual({ zoom: 1, from: 'none' });
		expect(resolveBootstrapZoom({ query: 0.8 })).toEqual({ zoom: 0.8, from: 'query' });
		expect(resolveBootstrapZoom({ stored: 0.9 })).toEqual({ zoom: 0.9, from: 'stored' });
		expect(resolveBootstrapZoom({ query: 0.8, stored: 1.2 })).toEqual({ zoom: 0.8, from: 'query' });                 // 壳导航:query 是壳此刻的档
		expect(resolveBootstrapZoom({ query: 0.8, stored: 1, reload: true })).toEqual({ zoom: 1, from: 'stored' });      // 🔴 换档后自刷新:键(最新)胜出,不读回启动旧档
		expect(resolveBootstrapZoom({ query: 0.8, reload: true })).toEqual({ zoom: 0.8, from: 'query' });                // 键缺席 → 退回 query
		expect(resolveBootstrapZoom({ query: -3, stored: 'abc' })).toEqual({ zoom: 1, from: 'none' });
		expect(resolveBootstrapZoom({ query: 99, stored: 0 , reload: true })).toEqual({ zoom: 1, from: 'none' });
	});

	it('getShellZoom:无源缺省 1;键兜底;越界值拒收', () => {
		expect(getShellZoom()).toBe(1);
		window.localStorage.setItem(SHELL_ZOOM_STORAGE_KEY, '0.9');
		expect(getShellZoom()).toBe(0.9);
		window.localStorage.setItem(SHELL_ZOOM_STORAGE_KEY, '-3');
		expect(getShellZoom()).toBe(1);
		window.localStorage.setItem(SHELL_ZOOM_STORAGE_KEY, 'abc');
		expect(getShellZoom()).toBe(1);
	});

	// 🔴 契约已于 2026-08-27 更换,不是把测试改绿:旧契约「innerHeight ÷ 声明缩放」本身
	// 就是事故根因。声明值/rect 探针都测不出旧 MacBook(rect 不反映 zoom)的真实布局空间,
	// 按它除等于没除 ⇒ 奇门/三式合一/主工作区三处底部死带。
	// 新契约:**直接量** fixed 铺满元素的 offsetHeight —— 不问缩放,故对任何引擎语义都成立。
	describe('getLayoutViewportHeight:直接量,不做缩放换算', () => {
		// jsdom 不做布局,offset* 恒 0 ⇒ 必须桩出一个「有布局」的引擎。
		// 宽高都要桩:measureLayoutViewport 要求两者皆 >0 才认作有效读数。
		const proto = window.HTMLElement.prototype;
		const owns = ['offsetWidth', 'offsetHeight'].map((k) => [k, Object.getOwnPropertyDescriptor(proto, k)]);
		const fake = (w, h) => {
			Object.defineProperty(proto, 'offsetWidth', {
				configurable: true, get(){ return this.style.position === 'fixed' ? w : 0; },
			});
			Object.defineProperty(proto, 'offsetHeight', {
				configurable: true, get(){ return this.style.position === 'fixed' ? h : 0; },
			});
		};
		// 声明缩放的唯一真值 = documentElement 内联 zoom(2026-09-19 契约;此前本组用「往传输层键里写 0.9」来声明,那正是病灶读法)。
		beforeEach(() => { __resetScaleCacheForTest(); document.documentElement.style.zoom = ''; });
		afterEach(() => {
			owns.forEach(([k, d]) => {
				if(d){ Object.defineProperty(proto, k, d); }
				else{ delete proto[k]; }
			});
			document.documentElement.style.zoom = '';
			__resetScaleCacheForTest();
		});

		it('量得到就用实测值 —— 且与声明缩放值无关(声明 0.9 也不影响结果)', () => {
			fake(1600, 1125);
			expect(getLayoutViewportHeight()).toBe(1125);
			document.documentElement.style.zoom = '0.9';
			expect(getLayoutViewportHeight()).toBe(1125);   // 不因声明值而改变 = 域混淆已根除
		});

		it('🔴 判别力:若退回旧写法(innerHeight ÷ 声明值),本例必判红', () => {
			fake(1600, 1125);
			document.documentElement.style.zoom = '0.9';
			const legacy = Math.round(window.innerHeight / 0.9);
			expect(getLayoutViewportHeight()).not.toBe(legacy);
		});

		it('量不到(jsdom 无布局)时退物理读数,不返回 0', () => {
			expect(getLayoutViewportHeight()).toBe(Math.round(window.innerHeight));
		});
	});
});
