// 方案库「用事人本命」存取对称:四工作台保存/历史写 natal+natalInput,载入回灌(onRestoreNatal/onNatalInputChange)。
// 工作台是函数组件(含 antd 控件),此处以源码锚 + 宿主 props 锚双向自证(与 classicalSurfaceParity 范式同)。
import fs from 'fs';
import path from 'path';

global.React = require('react');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

describe('择日方案库本命存取', () => {
	['BaziZeriWorkbench', 'LiurengZeriWorkbench', 'ZiweiZeriWorkbench', 'SanshiZeriWorkbench'].forEach((wb) => {
		it(`${wb}:保存带 natal+natalInput;载入回灌 natalInput 与 natal`, () => {
			// 本家派描述带本命区;存取都在共用壳(真渲染的存 / 取行为见 zeriWorkbenchShellBehaviour)
			expect(read(`${wb}.js`)).toMatch(/natal: \{\s*label:/);
			const src = read(`${wb}.js`) + read('ZeriWorkbenchShell.js');
			expect(src).toContain('if(school.natal){ conf.natal = natal; conf.natalInput = natalInput; }');
			// 本命与输入框同一校验(zeriNatal,与载入存案同):坏形本命 = 没有;输入框叠在构造缺省上
			expect(src).toContain("if(school.natal && (rec.config.natalInput || Object.prototype.hasOwnProperty.call(rec.config, 'natal')) && typeof onNatalInputChange === 'function'){ onNatalInputChange(restoredNatalInput(rec.config.natalInput)); }");
			expect(src).toContain("if(school.natal && Object.prototype.hasOwnProperty.call(rec.config, 'natal') && typeof onRestoreNatal === 'function'){ onRestoreNatal(normalizeSavedNatal(rec.config.natal)); }");
			expect(src).toMatch(/natal, natalInput, onNatalInputChange, onResolveNatal, onClearNatal, onRestoreNatal,/);
		});
	});
	['BaziZeriMain', 'LiurengZeriMain', 'ZiweiZeriMain', 'SanshiZeriMain'].forEach((host) => {
		it(`${host}:历史写 natalInput,挂 onRestoreNatal`, () => {
			const src = read(`${host}.js`);
			expect(src).toContain('pushHistory({ cfg, geo, options, natal, natalInput: this.state.natalInput }, this.state.tree)');
			expect(src).toContain('onRestoreNatal={(n)=>this.setState({ natal: normalizeSavedNatal(n) })}');
		});
	});
});
