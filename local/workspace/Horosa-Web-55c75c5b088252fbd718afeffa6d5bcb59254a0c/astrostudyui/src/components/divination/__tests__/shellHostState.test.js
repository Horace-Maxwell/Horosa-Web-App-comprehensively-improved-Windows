// 壳的渲染守卫把函数类属性一律当「没变」。右栏内容来自宿主页 state 时,宿主必须把 state 传进来,否则页签点不动、异步结果不上屏。
import fs from 'fs';
import path from 'path';
import { wrapperPropsEqual } from '../../../utils/chartUpdateGuard';
import { jsxNodes } from '../../../utils/__tests__/helpers/jsxProps';

const SRC = path.resolve(__dirname, '../../..');

function hostsOf(dir, out = []){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((entry)=>{
		const file = path.join(dir, entry.name);
		if(entry.isDirectory() && entry.name !== '__tests__'){ hostsOf(file, out); }
		else if(entry.name.endsWith('.js')){
			const source = fs.readFileSync(file, 'utf8');
			if(source.includes('<DivinationChartShell') && source.includes('this.setState(')){ out.push(path.relative(SRC, file)); }
		}
	});
	return out;
}
const HOSTS = hostsOf(path.join(SRC, 'components'));

describe('卜算壳的宿主状态', ()=>{
	test('宿主 state 变了,守卫放行重渲', ()=>{
		const renderRight = ()=>null;
		const state = { tab: 'a' };
		expect(wrapperPropsEqual({ renderRight, hostState: state }, { renderRight: ()=>null, hostState: state })).toBe(true);
		expect(wrapperPropsEqual({ renderRight, hostState: state }, { renderRight, hostState: { tab: 'b' } })).toBe(false);
	});

	test('宿主名单从源码现取', ()=>{
		expect(HOSTS.length).toBeGreaterThanOrEqual(3);
	});

	test.each(HOSTS)('%s 把自己的 state 传给壳', (file)=>{
		const shells = jsxNodes(fs.readFileSync(path.join(SRC, file), 'utf8'), 'DivinationChartShell');
		expect(shells.length).toBeGreaterThan(0);
		shells.forEach((shell)=>{ expect(shell.attrs.hostState).toBe('this.state'); });
	});
});
