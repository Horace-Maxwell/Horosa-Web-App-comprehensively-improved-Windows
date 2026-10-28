// 演禽「盘」子页三传注释的我 / 彼归属随左栏「我/彼归属」:默认流派是翻禽=我、倒将=彼,
// 注释不得写死「中传时禽(我/体)→ 末传翻禽(彼/用)」(只有凤凰演禽才是时禽=我)。
import React from 'react';
import moment from 'moment';
import { renderToStaticMarkup } from 'react-dom/server';
import YanQinBranchPanel from '../YanQinBranchPanel';
import { resolveWoBi, DEFAULT_YANQIN_SETTINGS } from '../yanqinSchools';

const fields = {
	date: { value: moment('2008-01-01') },
	time: { value: moment('2008-01-01 12:30:00') },
	gender: { value: 1 },
};

describe('演禽 盘子页 · 三传注释的我 / 彼归属', ()=>{
	test('默认流派:注释按设置写「翻禽=我/倒将=彼」,不再写死时禽为我', ()=>{
		const html = renderToStaticMarkup(<YanQinBranchPanel initialSub="pan" fields={fields} />);
		expect(html).toContain('三传流转');
		expect(html).not.toContain('中传时禽(我/体)');
		expect(html).not.toContain('末传翻禽(彼/用)');
		expect(html).toContain(resolveWoBi(DEFAULT_YANQIN_SETTINGS).note);
		expect(html).toContain('我/彼归属');
	});
});
