// 紫微页模块加载即登记引擎写入器:随盘还原同步写引擎单例与四化流派;左栏写偏好经包装即记进「你自己的设置」。
// 单独成文件:要一个从没加载过紫微页模块的干净模块环境。
import { applyZiweiRecordSettings, currentZiweiUserSeed, ZIWEI_SETTINGS_GEN_KEY } from '../ziweiRecordSettings';
import ZiWeiInput from '../../components/ziwei/ZiWeiInput';
import { ZWEngineOptions } from '../../components/ziwei/ziweiOptions';
import * as ZW from '../../constants/ZWConst';

beforeEach(()=>{ window.localStorage.clear(); });

it('还原同步写单例与四化流派(紫微页已加载)', ()=>{
	applyZiweiRecordSettings({ cid: 'eng', huoling: 'nanpai', sihuaSchool: 'zhongzhou' });
	expect(ZWEngineOptions.huoling).toBe('nanpai');
	expect(ZW.ZWSchool.school).toBe('zhongzhou');
	applyZiweiRecordSettings({ cid: 'eng2', [ZIWEI_SETTINGS_GEN_KEY]: 1 });
	expect(ZWEngineOptions.huoling).toBe('sanhe');
	expect(ZW.ZWSchool.school).toBe('beipai');
});

it('左栏亲手改设置 → 记进你自己的设置(新盘种子)', ()=>{
	const self = { setState(){}, redrawChart(){} };
	ZiWeiInput.prototype.onKongNamingChange.call(self, 'ancient');
	expect(currentZiweiUserSeed().kongNaming).toBe('ancient');
	ZiWeiInput.prototype.onOverlayToggle.call(self, 'zhongxian', 'zhongxian', 'ziweiZhongxian', true);
	expect(currentZiweiUserSeed().zhongxian).toBe(true);
});
