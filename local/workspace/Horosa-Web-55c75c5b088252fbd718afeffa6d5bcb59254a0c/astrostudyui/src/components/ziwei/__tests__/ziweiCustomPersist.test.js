// [跨会话双保险] 自定义亮度/四化表持久金标:
//   ① 保存失败(配额满)诚实告知+编辑器不关+成果不丢 ② 成功路径 IDB 镜像 ③ 启动自愈(LS 缺→镜像写回;LS 在→恒不覆盖)
import fs from 'fs';
import path from 'path';
import { mirrorZiweiCustomTable, restoreZiweiCustomTablesOnce } from '../../../utils/ziweiCustomTablesPersist';
import { putStoreRecord, getStoreRecord, AI_ANALYSIS_STORES } from '../../../utils/aiAnalysisStore';

afterEach(()=>{
	try{ localStorage.removeItem('ziweiBrightnessCustom'); localStorage.removeItem('ziweiSihuaCustom'); }catch(e){}
});

describe('镜像与自愈(jsdom 无 IDB=自动降内存店,同一 API 语义)', ()=>{
	test('🔴 LS 缺而镜像在 → 恢复写回;返回恢复清单', async ()=>{
		await mirrorZiweiCustomTable('brightness', JSON.stringify({ 紫微: { 子: '陷' } }));
		expect(localStorage.getItem('ziweiBrightnessCustom')).toBe(null);
		const restored = await restoreZiweiCustomTablesOnce();
		expect(restored.includes('brightness')).toBe(true);
		expect(JSON.parse(localStorage.getItem('ziweiBrightnessCustom'))['紫微']['子']).toBe('陷');
	});
	test('🔴 LS 已有值 → 恒不覆盖(用户现值优先于镜像)', async ()=>{
		await mirrorZiweiCustomTable('brightness', JSON.stringify({ 紫微: { 子: '陷' } }));
		localStorage.setItem('ziweiBrightnessCustom', JSON.stringify({ 紫微: { 子: '庙' } }));
		const restored = await restoreZiweiCustomTablesOnce();
		expect(restored.includes('brightness')).toBe(false);
		expect(JSON.parse(localStorage.getItem('ziweiBrightnessCustom'))['紫微']['子']).toBe('庙');
	});
	test('镜像 upsert 幂等:二次保存覆盖旧镜像;坏参零写入', async ()=>{
		await mirrorZiweiCustomTable('sihua', '{"甲":1}');
		await mirrorZiweiCustomTable('sihua', '{"甲":2}');
		const rec = await getStoreRecord(AI_ANALYSIS_STORES.workspaceMeta, 'ziwei_custom_sihua_table');
		expect(rec.json).toBe('{"甲":2}');
		expect(await mirrorZiweiCustomTable('nope', 'x')).toBe(null);
		expect(await mirrorZiweiCustomTable('sihua', '')).toBe(null);
	});
});

describe('保存回调双保险(源码守卫)', ()=>{
	const src = fs.readFileSync(path.join(__dirname, '..', 'ZiWeiInput.js'), 'utf8');
	test('🔴 亮度/四化保存:写失败→error 提示+return(编辑器不关);成功→镜像', ()=>{
		['onBrightnessCustomOk', 'onSihuaCustomOk'].forEach((h)=>{
			const i = src.indexOf(`${h}(table)`);
			const body = src.slice(i, src.indexOf('\n\t}', i));
			expect(`${h}:guard:${/if\(!safeLocalStorageSet\([\s\S]{0,120}message\.error\([\s\S]{0,160}return;/.test(body)}`).toBe(`${h}:guard:true`);
			expect(`${h}:mirror:${body.includes('mirrorZiweiCustomTable(')}`).toBe(`${h}:mirror:true`);
		});
	});
	test('启动自愈挂在 componentDidMount:恢复后失效双缓存+广播', ()=>{
		expect(/componentDidMount\(\)\{[\s\S]{0,600}restoreZiweiCustomTablesOnce\(\)[\s\S]{0,400}resetBrightnessCustomCache\(\)[\s\S]{0,200}resetHuaMap\(\)[\s\S]{0,200}bumpZwDisplayRev/.test(src)).toBe(true);
	});
	test('🔴 持久工具绝不新建 store/升版本(住既有 workspace_meta)', ()=>{
		const psrc = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'utils', 'ziweiCustomTablesPersist.js'), 'utf8');
		expect(psrc.includes('workspaceMeta')).toBe(true);
		expect(psrc.includes('createObjectStore')).toBe(false);
		expect(psrc.includes('DB_VERSION')).toBe(false);
	});
});
