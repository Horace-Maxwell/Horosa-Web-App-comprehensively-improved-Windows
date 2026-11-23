// 主页外壳 · 账户与配置抽屉:星盘配置、注册、登录、忘记 / 修改密码、修改参数
// 从 index.js 按职责拆出的 AstroIndex 内层函数 / Hook 回调体 / 渲染树片段:原文原样,用到的局部名字经第一个参数显式传入;
// 门面原位置换成调用它的包装 / 箭头 / 表达式,调用那一刻取值传入(与闭包读到的是同一份)。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import React from 'react';
import LoginForm from '../../../components/user/LoginForm';
import RegisterForm from '../../../components/user/RegisterForm';
import ResetPwdForm from '../../../components/user/ResetPwdForm';
import ChangePwdForm from '../../../components/user/ChangePwdForm';
import ChangeParamsFormComp from '../../../components/user/ChangeParamsFormComp';
import AstroFormComp from '../../../components/astro/AstroFormComp';
import { convertToArray } from '../../../utils/helper';
import { XQDrawer as Drawer } from '../../../components/xq-ui';

// AstroIndex 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderQueryDrawer = ({ closeDrawer, drawerVisible, fields, aryfields, dispatch })=>(
	<Drawer
	    title='星盘配置'
	    width={720}
	    placement="left"
	    onClose={closeDrawer}
	    maskClosable={true}
	    destroyOnClose={true}
	    open={drawerVisible.query}
	    style={{
	        height: 'calc(100% - 0px)',
	        overflow: 'auto',
	        paddingBottom: 53,
	        backgroundColor: 'transparent',
	    }}        
	>
	    <AstroFormComp 
	        { ...fields }
	        fields={fields}
	        fieldsAry={aryfields}
	        dispatch={dispatch}
	    />
	</Drawer>
);

// AstroIndex 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderRegisterDrawer = ({ closeDrawer, drawerVisible, registerFields, tokenImg, aryregflds, dispatch })=>(
	<Drawer
	    title='注册'
	    width={300}
	    placement="left"
	    onClose={closeDrawer}
	    maskClosable={true}
	    destroyOnClose={true}
	    open={drawerVisible.register}
	    style={{
	        height: 'calc(100% - 0px)',
	        overflow: 'auto',
	        paddingBottom: 53,
	        backgroundColor: 'transparent',
	    }}        
	>
	    <RegisterForm 
	        {...registerFields}
	        tokenImg={tokenImg}
	        fields={registerFields}
	        fieldsAry={aryregflds}
	        dispatch={dispatch}
	    />
	</Drawer>
);

// AstroIndex 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderLoginDrawer = ({ closeDrawer, drawerVisible, loginFields, aryloginflds, dispatch })=>(
	<Drawer
	    title='登录'
	    width={300}
	    placement="left"
	    onClose={closeDrawer}
	    maskClosable={true}
	    destroyOnClose={true}
	    open={drawerVisible.login}
	    style={{
	        height: 'calc(100% - 0px)',
	        overflow: 'auto',
	        paddingBottom: 53,
	        backgroundColor: 'transparent',
	    }}        
	>
	    <LoginForm 
	        {...loginFields}
	        fields={loginFields}
	        fieldsAry={aryloginflds}
	        dispatch={dispatch}
	    />
	</Drawer>
);

// AstroIndex 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderResetPwdDrawer = ({ closeDrawer, drawerVisible, registerFields, tokenImg, aryregflds, dispatch })=>(
	<Drawer
	    title='忘记密码'
	    width={300}
	    placement="left"
	    onClose={closeDrawer}
	    maskClosable={true}
	    destroyOnClose={true}
	    open={drawerVisible.resetpwd}
	    style={{
	        height: 'calc(100% - 0px)',
	        overflow: 'auto',
	        paddingBottom: 53,
	        backgroundColor: 'transparent',
	    }}        
	>
	    <ResetPwdForm 
	        {...registerFields}
	        tokenImg={tokenImg}
	        fields={registerFields}
	        fieldsAry={aryregflds}
	        dispatch={dispatch}
	    />
	</Drawer>
);

// AstroIndex 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderChangePwdDrawer = ({ closeDrawer, drawerVisible, pwdFields, dispatch })=>(
	<Drawer
	    title='修改密码'
	    width={300}
	    placement="left"
	    onClose={closeDrawer}
	    maskClosable={true}
	    destroyOnClose={true}
	    open={drawerVisible.changepwd}
	    style={{
	        height: 'calc(100% - 0px)',
	        overflow: 'auto',
	        paddingBottom: 53,
	        backgroundColor: 'transparent',
	    }}        
	>
	    <ChangePwdForm 
	        {...pwdFields}
	        fields={pwdFields}
	        fieldsAry={convertToArray(pwdFields)}
	        dispatch={dispatch}
	    />
	</Drawer>
);

// AstroIndex 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderChangeParamsDrawer = ({ closeDrawer, drawerVisible, fields, aryfields, dispatch })=>(
	<Drawer
	    title='修改参数'
	    width={700}
	    placement="left"
	    onClose={closeDrawer}
	    maskClosable={true}
	    destroyOnClose={true}
	    open={drawerVisible.changeparams}
	    style={{
	        height: 'calc(100% - 0px)',
	        overflow: 'auto',
	        paddingBottom: 53,
	        backgroundColor: 'transparent',
	    }}        
	>
	    <ChangeParamsFormComp 
	        {...fields}
	        fields={fields}
	        fieldsAry={aryfields}
	        dispatch={dispatch}
	    />
	</Drawer>
);
