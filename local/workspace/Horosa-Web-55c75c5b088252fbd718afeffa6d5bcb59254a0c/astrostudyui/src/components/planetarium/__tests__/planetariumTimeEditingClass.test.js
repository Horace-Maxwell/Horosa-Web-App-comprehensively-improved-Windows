// 天文馆时间编辑态:body 类名开关直接调 classList(document.body 在浏览器 / jsdom / 无头运行时都存在,单 token 的 remove / toggle 不会抛),
// 外面包的 try 走不到,已去;同一函数里前后两行的 add/removeEventListener 本就不带保护。
import fs from 'fs';
import path from 'path';
const { readSource } = require('../../../utils/__tests__/helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

const SRC = readSource(path.resolve(__dirname, '..', 'PlanetariumBabylon.js'))
	.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('天文馆 planetarium-time-editing 类名开关', () => {
	test('四处开关都在,且不再包 try', () => {
		expect(SRC.split("document.body.classList.remove('planetarium-time-editing');").length - 1).toBe(3);
		expect(SRC.split("document.body.classList.toggle('planetarium-time-editing', next);").length - 1).toBe(1);
		expect(SRC).not.toMatch(/try\s*\{\s*document\.body\.classList/);
	});
	test('classList 单 token 开关行为(remove 不存在的类、toggle 强制值)不抛', () => {
		document.body.classList.remove('planetarium-time-editing');
		document.body.classList.toggle('planetarium-time-editing', true);
		expect(document.body.classList.contains('planetarium-time-editing')).toBe(true);
		document.body.classList.toggle('planetarium-time-editing', false);
		expect(document.body.classList.contains('planetarium-time-editing')).toBe(false);
	});
});
