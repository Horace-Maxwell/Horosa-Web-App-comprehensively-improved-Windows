// [Q-271/ZC-21] 方案库「用事人本命」存取对称:四工作台保存/历史写 natal+natalInput,载入回灌(onRestoreNatal/onNatalInputChange)。
// 工作台是函数组件(含 antd 控件),此处以源码锚 + 宿主 props 锚双向自证(与 classicalSurfaceParity 范式同)。
import fs from 'fs';
import path from 'path';

global.React = require('react');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

describe('择日方案库本命存取', () => {
	['BaziZeriWorkbench', 'LiurengZeriWorkbench', 'ZiweiZeriWorkbench', 'SanshiZeriWorkbench'].forEach((wb) => {
		it(`${wb}:保存带 natal+natalInput;载入回灌 natalInput 与 natal`, () => {
			const src = read(`${wb}.js`);
			expect(src).toContain('saveScheme(schemeName, { cfg, geo, options, natal, natalInput }, tree)');
			expect(src).toContain("if(rec.config.natalInput && typeof onNatalInputChange === 'function')");
			expect(src).toContain("if(Object.prototype.hasOwnProperty.call(rec.config, 'natal') && typeof onRestoreNatal === 'function'){ onRestoreNatal(rec.config.natal || null); }");
			expect(src).toMatch(/natal, natalInput, onNatalInputChange, onResolveNatal, onClearNatal, onRestoreNatal,/);
		});
	});
	['BaziZeriMain', 'LiurengZeriMain', 'ZiweiZeriMain', 'SanshiZeriMain'].forEach((host) => {
		it(`${host}:历史写 natalInput,挂 onRestoreNatal`, () => {
			const src = read(`${host}.js`);
			expect(src).toContain('pushHistory({ cfg, geo, options, natal, natalInput: this.state.natalInput }, this.state.tree)');
			expect(src).toContain('onRestoreNatal={(n)=>this.setState({ natal: n || null })}');
		});
	});
});
