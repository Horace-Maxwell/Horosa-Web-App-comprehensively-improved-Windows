// 时间控件 hook 取值无副作用 + 外部改动必同步(共用件病根):此前 hook.getValue() 一调就把实例冻在当时的值,
// 之后弹层里改 / 双击键入 / 「此刻」/ 载入带来的新时刻再也同步不进来,「起盘」/ 预取读到旧值把时间改回去。
// 连点步进时父级追赶中的中间值仍认得(不当外部改动、不退回)。
import DateTimeSelector from '../DateTimeSelector';
import DateTime from '../DateTime';

const at = (s)=>{ const d = new DateTime(); d.setZone('+08:00'); return d.parse(s, 'YYYY-MM-DD HH:mm:ss'); };

function makeInst(value, extra){
	const hook = {};
	const sent = [];
	const inst = new DateTimeSelector({ value, hook, onChange: (r)=>sent.push(r), ...(extra || {}) });
	inst.setState = (patch)=>{ inst.state = { ...inst.state, ...(typeof patch === 'function' ? patch(inst.state) : patch) }; };
	const setProps = (next)=>{ const prev = inst.props; inst.props = { ...inst.props, ...next }; inst.render(); inst.componentDidUpdate(prev); };
	inst.render();
	return { inst, hook, sent, setProps };
}

describe('时间控件 hook 同步', ()=>{
	test('读一次 hook 之后,外部改成 14:00 → hook 读到 14:00(不再冻在 10:00)', ()=>{
		const { hook, setProps } = makeInst(at('2026-05-05 10:00:00'));
		expect(hook.getValue().value.format('HH:mm')).toBe('10:00');
		setProps({ value: at('2026-05-05 14:00:00') });
		expect(hook.getValue().value.format('HH:mm')).toBe('14:00');
	});
	test('连点步进 3 下、父级只追上第 1 步 → 仍是本地最新(10:03);追平后解除', ()=>{
		const { inst, hook, setProps } = makeInst(at('2026-05-05 10:00:00'), { showAdjust: true });
		['10:01', '10:02', '10:03'].forEach((t)=>inst.onChanged(at(`2026-05-05 ${t}:00`)));
		setProps({ value: at('2026-05-05 10:01:00') });
		expect(hook.getValue().value.format('HH:mm')).toBe('10:03');
		setProps({ value: at('2026-05-05 10:03:00') });
		expect(inst.changing).toBe(false);
	});
	test('步进中途外部改成 14:00(不是本实例发出的任一步)→ 以外部为准', ()=>{
		const { inst, hook, setProps } = makeInst(at('2026-05-05 10:00:00'), { showAdjust: true });
		inst.onChanged(at('2026-05-05 10:01:00'));
		setProps({ value: at('2026-05-05 14:00:00') });
		expect(hook.getValue().value.format('HH:mm')).toBe('14:00');
		expect(inst.changing).toBe(false);
	});
	test('外部值按分钟截掉秒(10:05:37 → 10:05:00)也能同步,不永久卡住', ()=>{
		const { inst, hook, setProps } = makeInst(at('2026-05-05 10:00:00'), { showAdjust: true });
		inst.onChanged(at('2026-05-05 10:05:37'));
		setProps({ value: at('2026-05-05 10:05:00') });
		expect(inst.changing).toBe(false);
		setProps({ value: at('2026-05-05 11:00:00') });
		expect(hook.getValue().value.format('HH:mm')).toBe('11:00');
	});
});
