// 天文馆沉浸模式:「退出沉浸」按钮与右上性能读数条锚在同一角 → 沉浸时读数条必须让到按钮下方,不能被按钮盖住。
import fs from 'fs';
import path from 'path';

const LESS = fs.readFileSync(path.join(__dirname, '..', 'planetarium.less'), 'utf8');
const px = (block, prop) => { const m = block.match(new RegExp(`${prop}:\\s*(\\d+)px`)); return m ? Number(m[1]) : null; };
const block = (sel) => { const at = LESS.indexOf(`${sel} {`); return at < 0 ? '' : LESS.slice(at, LESS.indexOf('}', at)); };

describe('天文馆沉浸模式右上角', () => {
	test('读数条在沉浸时下移到「退出沉浸」按钮底边之下', () => {
		const exit = block('.planetarium-immersive-exit');
		const exitTop = px(exit, 'top');
		const padY = Number((exit.match(/padding:\s*(\d+)px/) || [])[1]);
		const font = px(exit, 'font-size');
		expect([exitTop, padY, font].every(Number.isFinite)).toBe(true);
		const exitBottom = exitTop + padY * 2 + Math.ceil(font * 1.5) + 2;   // 字高按 1.5 倍行高 + 上下边框
		const moved = block('.horosa-planetarium-page.is-immersive .planetarium-scene-readout-tr');
		expect(px(moved, 'top')).toBeGreaterThan(exitBottom);
		// 非沉浸时读数条仍在原位
		expect(px(block('.planetarium-scene-readout-tr'), 'top')).toBe(14);
	});
});
