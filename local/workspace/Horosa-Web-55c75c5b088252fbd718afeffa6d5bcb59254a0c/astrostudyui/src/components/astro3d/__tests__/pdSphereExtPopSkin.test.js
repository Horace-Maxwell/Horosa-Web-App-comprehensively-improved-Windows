// 主限法「应星 / 迫星扩展」面板的皮肤与单点契约。
//
// 🔴 病理一(可读性):天球那份弹层用 getPopupContainer 挂进 .horosa-pdsphere-chrome,而 antd
//    Checkbox 的 .ant-checkbox-wrapper **本身就是个 <label>** → 被工具条那条「恒暗底亮字」的
//    `.horosa-pdsphere-chrome label{color:#c8d4e8}` 命中;可弹层自身皮肤走通用 popover 规则
//    (var(--horosa-surface-raised),亮色主题下近白)→ **白底 + 浅字,实测 1.36:1,几乎不可见**。
//    「容器级颜色规则 + portal 进该容器的独立皮肤浮层」是通用失配形态,不是个案。
//
// 🔴 病理二(单点):该面板原本在天球与表格**各写一份**几乎逐字相同的 JSX。修完天球那份的
//    可读性后立刻产生外观分叉(字号 12 vs 11、金线 0.42 vs 0.3、组标题类名有无)——
//    「同一功能两份实现」必然漏改。现已抽成 PdExtensionPanel 单点,本文件锁住它不再被复制回去。
//
// jsdom 测不了真实 CSS 层叠(那要真机 getComputedStyle,已另做实测:亮/暗双主题下面板底
// #0b1120、选项 12.59:1、组标题 16.19:1、链接 8.85:1、金框深色对勾 8.42:1),
// 故这里锁**源码级契约**,守最容易被后人"顺手简化"掉的几处。
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..', '..', '..');
const PANEL = fs.readFileSync(path.join(SRC, 'components', 'astro', 'PdExtensionPanel.js'), 'utf8');
const SPHERE = fs.readFileSync(path.join(SRC, 'components', 'astro3d', 'AstroPDSphere.js'), 'utf8');
const TABLE = fs.readFileSync(path.join(SRC, 'components', 'astro', 'AstroPrimaryDirection.js'), 'utf8');
const APPLESS = fs.readFileSync(path.join(SRC, 'layouts', 'app.less'), 'utf8');

const CLS = 'horosa-pdsphere-ext-pop';

describe('🔴 主限法扩展面板 · 单点契约', ()=>{
	it('① 两个宿主都走共享组件,且都不再自己写弹层 JSX', ()=>{
		expect(SPHERE).toContain("import PdExtensionPanel from '../astro/PdExtensionPanel'");
		expect(TABLE).toContain("import PdExtensionPanel from './PdExtensionPanel'");
		expect(SPHERE).toContain('<PdExtensionPanel');
		expect(TABLE).toContain('<PdExtensionPanel');
		// 复制回去的判据:宿主里不该再出现选项数组的直接渲染
		expect(SPHERE).not.toContain('PD_SIGNIFICATOR_OPTIONS.map');
		expect(TABLE).not.toContain('PD_SIGNIFICATOR_OPTIONS.map');
		expect(SPHERE).not.toContain('PD_PROMISSOR_TYPE_OPTIONS.map');
		expect(TABLE).not.toContain('PD_PROMISSOR_TYPE_OPTIONS.map');
	});

	it('② 皮肤分档正确:天球 dark(恒暗底)、表格 theme(跟随主题)', ()=>{
		const sphereCall = SPHERE.slice(SPHERE.indexOf('<PdExtensionPanel'), SPHERE.indexOf('<PdExtensionPanel') + 420);
		expect(sphereCall).toContain("variant='dark'");
		const tableCall = TABLE.slice(TABLE.indexOf('<PdExtensionPanel'), TABLE.indexOf('<PdExtensionPanel') + 420);
		expect(tableCall).toContain("variant='theme'");
	});

	it('③ 组件只在 dark 档挂暗底 overlayClassName —— 摘掉即回到白底浅字(不可读)', ()=>{
		expect(PANEL).toContain(`dark ? '${CLS}' : undefined`);
		expect(PANEL).toContain('getPopupContainer');
		// 组标题类名同样只在 dark 档挂
		expect(PANEL).toContain("dark ? 'horosa-pdsphere-ext-head' : undefined");
	});

	it('④ 尺寸/描边是组件内单点常量(不许两档分叉)', ()=>{
		expect(PANEL).toMatch(/const FS_HEAD = 12;/);
		expect(PANEL).toMatch(/const FS_LINK = 12;/);		// 曾是 11px,用户报过偏小
		expect(PANEL).toMatch(/const GOLD_UNDERLINE = 'rgba\(215, 173, 105, 0\.42\)'/);
		expect(PANEL).toMatch(/const GOLD_DIVIDER = 'rgba\(215, 173, 105, 0\.32\)'/);
		// 常量只定义一次、被 headStyle / Group 引用 —— 不该出现硬编码的 fontSize: 11
		expect(PANEL).not.toMatch(/fontSize:\s*11\b/);
	});

	// 🔴 实测:antd 默认链接蓝 #1890ff 在 theme 档的白底上只有 3.24:1(不达 WCAG AA 4.5)。
	//    改走 --horosa-accent-strong 后 6.75:1;dark 档另有 (0,2,1) 规则盖成亮金 #d8ab52(8.85:1)。
	//    两处都实机 getComputedStyle 验过。删掉这个类名 = 静默退回 3.24:1,故锁住。
	it('⑤ 全选/清空链接挂了对比度达标的类名(不留 antd 默认蓝)', ()=>{
		expect((PANEL.match(/className='horosa-pd-ext-link'/g) || []).length).toBe(2);
		expect(APPLESS).toMatch(/\.horosa-pd-ext-link\s*\{[^}]*color:\s*var\(--horosa-accent-strong\)/);
		// dark 档那条必须特异度更高(否则暗底上会变成深棕看不清)
		expect(APPLESS).toContain(`.${CLS} .ant-popover-inner-content a`);
	});

	it('⑥ 两组选项都渲染,且各自的全选/清空都接到回调', ()=>{
		expect(PANEL).toContain("title='应星扩展'");
		expect(PANEL).toContain("title='迫星扩展'");
		expect(PANEL).toContain('onSignificatorsChange');
		expect(PANEL).toContain('onPromissorTypesChange');
		expect(PANEL).toContain('onChange(options.map((o)=>o.value))');	// 全选
		expect(PANEL).toContain('onChange([])');							// 清空
	});
});

describe('🔴 暗底皮肤 less 契约(app.less)', ()=>{
	it('① 面板底 + 文字 + 组标题 + 链接四件齐,面板底必须 !important', ()=>{
		expect(APPLESS).toMatch(new RegExp(`\\.${CLS}\\s+\\.ant-popover-inner\\s*\\{`));
		const innerBlock = APPLESS.slice(APPLESS.indexOf(`.${CLS} .ant-popover-inner {`));
		expect(innerBlock.slice(0, 200)).toMatch(/background:\s*#0b1120\s*!important/);
		expect(APPLESS).toMatch(new RegExp(`\\.${CLS}\\s+\\.ant-popover-inner-content\\s*\\{`));
		expect(APPLESS).toContain(`.${CLS} .horosa-pdsphere-ext-head`);
		expect(APPLESS).toMatch(new RegExp(`\\.${CLS}\\s+\\.ant-popover-inner-content a\\s*\\{`));
	});

	// 🔴 最容易被"简化"掉的一条:勾选框规则少了 .horosa-workspace-shell 前缀就会被本文件
	//    后段的 `.horosa-workspace-shell .ant-checkbox-inner{…}` 压过 —— 两者**同特异度
	//    (0,2,0)**,那条源码更靠后所以它赢(实测勾选框被染成浅底 rgba(242,247,254,.78))。
	it('② 勾选框规则带 .horosa-workspace-shell 前缀(否则被后段同特异度规则压过)', ()=>{
		expect(APPLESS).toContain(`.horosa-workspace-shell .${CLS} .ant-checkbox-inner`);
		expect(APPLESS).toContain(`.horosa-workspace-shell .${CLS} .ant-checkbox-checked .ant-checkbox-inner`);
		expect(APPLESS).not.toMatch(new RegExp(`(^|\\n)\\s*\\.${CLS}\\s+\\.ant-checkbox-inner\\s*\\{`));
		expect(APPLESS).toContain('.horosa-workspace-shell .ant-checkbox-inner');	// 那条"抢赢"的仍在
	});

	it('③ 金底对勾用深色(白勾在金底上只有约 2.1:1)', ()=>{
		expect(APPLESS).toContain(`.horosa-workspace-shell .${CLS} .ant-checkbox-checked .ant-checkbox-inner::after`);
		const i = APPLESS.indexOf(`.${CLS} .ant-checkbox-checked .ant-checkbox-inner::after`);
		expect(APPLESS.slice(i, i + 150)).toMatch(/border-color:\s*#101725/);
	});

	it('④ 有"浮层内 label 跟随自身皮肤"的预防规则,已自带皮肤的两个弹层被排除', ()=>{
		expect(APPLESS).toContain(`.ant-popover:not(.${CLS}) label`);
		expect(APPLESS).toContain('.ant-dropdown:not(.horosa-pdsphere-dark-pop) label');
	});

	it('⑤ 工具条那条「label 恒亮字」仍在(它是本 bug 的成因,也是工具条本体的正确设计)', ()=>{
		expect(APPLESS).toContain('.horosa-workspace-shell .horosa-pdsphere-chrome label');
	});
});
