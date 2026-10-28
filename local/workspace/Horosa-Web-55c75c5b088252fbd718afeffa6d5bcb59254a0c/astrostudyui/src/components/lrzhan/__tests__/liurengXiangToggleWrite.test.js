// 六壬「取象」开关:亲手开关时把状态写进本机(safeLocalStorageSet 自带环境判断与异常兜底,这里直调)。
import fs from 'fs';
import path from 'path';
import LiuRengMain from '../LiuRengMain';
import { classifyStorageKey } from '../../../utils/storageKeyRegistry';
const { readSource } = require('../../../utils/__tests__/helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

describe('六壬取象开关落盘', ()=>{
	beforeEach(()=>{ window.localStorage.removeItem('liurengXiangOn'); });

	test('开 → 写 1、关 → 写 0,state 同步', ()=>{
		const host = { state: { xiangOn: false }, setState(p){ this.state = { ...this.state, ...p }; } };
		LiuRengMain.prototype.onToggleXiang.call(host, true);
		expect(window.localStorage.getItem('liurengXiangOn')).toBe('1');
		expect(host.state.xiangOn).toBe(true);
		LiuRengMain.prototype.onToggleXiang.call(host, 0);
		expect(window.localStorage.getItem('liurengXiangOn')).toBe('0');
		expect(host.state.xiangOn).toBe(false);
	});

	test('键已登记(写入不会被登记闸拦下)', ()=>{
		expect(classifyStorageKey('liurengXiangOn')).toBeTruthy();
	});

	test('源码:开关处直调写入,不再外包环境判断与 try', ()=>{
		const src = readSource(path.join(__dirname, '..', 'LiuRengMain.js'));
		const body = src.slice(src.indexOf('\tonToggleXiang(checked){'), src.indexOf('\tonToggleXiang(checked){') + 200);
		expect(body).toContain("\t\tsafeLocalStorageSet('liurengXiangOn', on ? '1' : '0');\n\t\tthis.setState({ xiangOn: on });");
		expect(body).not.toContain('typeof localStorage');
		expect(body).not.toContain('try{');
	});
});
