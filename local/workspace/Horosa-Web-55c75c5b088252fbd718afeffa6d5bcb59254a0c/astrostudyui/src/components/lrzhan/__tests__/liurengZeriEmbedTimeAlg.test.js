// 六壬择日里内嵌的六壬盘不出「时间算法」:扫描引擎恒按真太阳时判,内嵌盘改了只会「所见≠所判」;独立六壬页照常有。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LiuRengMain from '../LiuRengMain';

global.React = React;   // 页面文件按应用构建的自动 React 注入写 JSX,单测环境补上

require('../../../models/astro');   // 注册字段工厂
const { fieldsSchemaBaseline } = require('../../../utils/recordFieldsRestore');

function labelsOf(scope){
	const fields = fieldsSchemaBaseline();
	const inst = new LiuRengMain({ fields, techniqueScope: scope, dispatch: ()=>{} });
	const html = renderToStaticMarkup(<div>{inst.renderInputPanel([])}</div>);
	return Array.from(html.matchAll(/<span[^>]*>([^<]*)<\/span>/g)).map((m)=>m[1]);
}

test('🔴 独立页有「时间算法」;择日内嵌(liurengzeri / sanshizeri)没有', ()=>{
	expect(labelsOf('liureng')).toContain('时间算法');
	expect(labelsOf('liurengzeri')).not.toContain('时间算法');
	expect(labelsOf('liurengzeri')).toContain('起课法');   // 其余照常
});
