// [F7 根修] 方案值域审计:方案树引用「已删条件类 / 已删选项值」时必须报出人话 issue。
// 判别向量纪律:先证「病态输入必报」,再证「合法输入零报」——只测后者的审计器没有判别力。
import fs from 'fs';
import path from 'path';
import { auditTreeAgainstRegistry, newLeaf, newGroup, CONDITION_TYPES } from '../conditionTypes';

// ── 发行形态自适应(照 popupAlignStaticGuard 范式):private 技法注册表在精简发行版不存在,
// 顶部裸 import 会让本套件在该形态直接炸;改为「文件在场才惰性 require」,缺席自动只测共享面。
const SRC = path.resolve(__dirname, '..');
function lazyRegistry(rel, exportName){
	if(!fs.existsSync(path.join(SRC, `${rel}.js`))){ return null; }
	// eslint-disable-next-line global-require, import/no-dynamic-require
	return require(`../${rel}`)[exportName] || null;
}
const LIURENG_CONDITION_TYPES = lazyRegistry('liurengZeriConditionTypes', 'LIURENG_CONDITION_TYPES');
const lrFactories = fs.existsSync(path.join(SRC, 'liurengZeriConditionTypes.js'))
	// eslint-disable-next-line global-require
	? require('../liurengZeriConditionTypes')
	: null;
const newLiurengLeaf = lrFactories ? lrFactories.newLiurengLeaf : null;
const newLiurengGroup = lrFactories ? lrFactories.newLiurengGroup : null;
// 「全注册表缺省叶零报」矩阵:登记全部 private 技法注册表(黄历/八字/太乙/紫微/六壬/奇门/
// 三式/七政/印度)——注册表自身 defaults×options 的自洽由此全员看守(此前只锚了 3 家)。
const PRIVATE_REGISTRIES = [
	['huangliZeriConditionTypes', 'HUANGLI_CONDITION_TYPES'],
	['baziZeriConditionTypes', 'BAZI_CONDITION_TYPES'],
	['taiyiZeriConditionTypes', 'TAIYI_CONDITION_TYPES'],
	['ziweiZeriConditionTypes', 'ZIWEI_CONDITION_TYPES'],
	['liurengZeriConditionTypes', 'LIURENG_CONDITION_TYPES'],
	['qimenConditionTypes', 'QIMEN_CONDITION_TYPES'],
	['sanshiZeriConditionTypes', 'SANSHI_CONDITION_TYPES'],
	['qizhengZeriConditionTypes', 'QIZHENG_CONDITION_TYPES'],
	['indiaZeriConditionTypes', 'INDIA_CONDITION_TYPES'],
].map(([rel, name]) => [name, lazyRegistry(rel, name)]).filter(([, reg]) => !!reg);

describe('auditTreeAgainstRegistry(F7:载入方案静默恒假根修)', () => {
	it('🔴 判别向量A:multiselect 含已删选项值 → 必报且点名字段与值', () => {
		if(!LIURENG_CONDITION_TYPES){ return; }	// 精简发行形态:private 注册表缺席
		const leaf = newLiurengLeaf('ke_name');
		leaf.params = { values: ['元首课', '天魁课(已删)'] };
		const root = { ...newLiurengGroup('all'), children: [leaf] };
		const issues = auditTreeAgainstRegistry(root, LIURENG_CONDITION_TYPES);
		expect(issues.length).toBe(1);
		expect(issues[0]).toContain('天魁课(已删)');
		expect(issues[0]).toContain('恒不命中');
	});

	it('🔴 判别向量B:条件类整个已删 → 必报', () => {
		if(!LIURENG_CONDITION_TYPES){ return; }
		const root = {
			...newLiurengGroup('all'),
			children: [{ kind: 'leaf', type: 'type_deleted_in_v9', negate: false, joiner: 'all', params: {} }],
		};
		const issues = auditTreeAgainstRegistry(root, LIURENG_CONDITION_TYPES);
		expect(issues.length).toBe(1);
		expect(issues[0]).toContain('type_deleted_in_v9');
	});

	it('🔴 判别向量C:select(单值)含已删值 → 必报;嵌套分组内也逃不掉', () => {
		if(!LIURENG_CONDITION_TYPES){ return; }
		const leaf = newLiurengLeaf('tianpan_at');
		leaf.params = { ...leaf.params, di: '亥亥亥' };	// select 字段塞非法值
		const inner = { ...newLiurengGroup('any'), children: [leaf] };
		const root = { ...newLiurengGroup('all'), children: [newLiurengLeaf('zhou_ye'), inner] };
		const issues = auditTreeAgainstRegistry(root, LIURENG_CONDITION_TYPES);
		expect(issues.length).toBe(1);
		expect(issues[0]).toContain('亥亥亥');
	});

	it('合法树(缺省参数 + 显式合法值)→ 零报', () => {
		if(!LIURENG_CONDITION_TYPES){ return; }
		const a = newLiurengLeaf('ke_name');
		a.params = { values: ['元首课'] };
		const root = { ...newLiurengGroup('all'), children: [a, newLiurengLeaf('zhou_ye')] };
		expect(auditTreeAgainstRegistry(root, LIURENG_CONDITION_TYPES)).toEqual([]);
	});

	it('text/number/动态字段不参与审计(宁漏勿误);空树/null 安全', () => {
		expect(auditTreeAgainstRegistry(null, CONDITION_TYPES)).toEqual([]);
		expect(auditTreeAgainstRegistry(newGroup('all'), CONDITION_TYPES)).toEqual([]);
	});

	it('🔴 showIf 条件字段双向:不生效分支跳过(不误报);生效分支失效值仍必报', () => {
		// midpoint 的 targetId 是同 key 双形态字段:planet 形态(body)/angle 形态(select 四轴)。
		// 首版审计器不看 showIf,把缺省 targetKind=planet 下的 targetId='Venus' 误报成
		// 「四轴含已失效选项」——本例即该次误报的判别向量,双向锁死。
		const ok = { ...newGroup('all'), children: [{ kind: 'leaf', type: 'midpoint', negate: false, joiner: 'all', params: {} }] };
		expect(auditTreeAgainstRegistry(ok, CONDITION_TYPES)).toEqual([]);
		const bad = { ...newGroup('all'), children: [{ kind: 'leaf', type: 'midpoint', negate: false, joiner: 'all', params: { targetKind: 'angle', targetId: 'NotAnAxis' } }] };
		const issues = auditTreeAgainstRegistry(bad, CONDITION_TYPES);
		expect(issues.length).toBe(1);
		expect(issues[0]).toContain('NotAnAxis');
	});

	it('全技法注册表自洽:天星 + 在场的全部技法注册表,缺省叶全量零报', () => {
		// 天星(共享面,任何发行形态必在)
		Object.keys(CONDITION_TYPES).forEach((t) => {
			const root = { ...newGroup('all'), children: [newLeaf(t)] };
			const issues = auditTreeAgainstRegistry(root, CONDITION_TYPES);
			expect({ t, issues }).toEqual({ t, issues: [] });
		});
		// 九私有注册表(在场即锚;泛叶 params={} = 纯缺省形态)
		PRIVATE_REGISTRIES.forEach(([name, reg]) => {
			Object.keys(reg).forEach((t) => {
				const root = { kind: 'group', joiner: 'all', negate: false, children: [{ kind: 'leaf', type: t, negate: false, joiner: 'all', params: {} }] };
				const issues = auditTreeAgainstRegistry(root, reg);
				expect({ name, t, issues }).toEqual({ name, t, issues: [] });
			});
		});
	});

	it('私有注册表矩阵不空转:本仓形态九家必须全在场(防 lazyRegistry 路径漂移致全 skip 假绿)', () => {
		if(!fs.existsSync(path.join(SRC, 'liurengZeriConditionTypes.js'))){ return; }	// 精简形态跳过
		expect(PRIVATE_REGISTRIES.map(([n]) => n).sort()).toEqual([
			'BAZI_CONDITION_TYPES', 'HUANGLI_CONDITION_TYPES', 'INDIA_CONDITION_TYPES',
			'LIURENG_CONDITION_TYPES', 'QIMEN_CONDITION_TYPES', 'QIZHENG_CONDITION_TYPES',
			'SANSHI_CONDITION_TYPES', 'TAIYI_CONDITION_TYPES', 'ZIWEI_CONDITION_TYPES',
		]);
	});
});
