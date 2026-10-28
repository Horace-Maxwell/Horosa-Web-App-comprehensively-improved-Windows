
const ErrMsg = {
    'pwderror': '密码错误',
    'no.user.or.pwderror': '无此用户或密码错误',
    'user.state.abnormal': '用户状态异常',
    'smstoken.error.-4': '手机号与验证码不一致',
    'smstoken.error.-3': '短信验证码错误',
    'smstoken.error.-2': '短信验证码为空',
    'smstoken.error.-1': '短信验证码超时',
    'smstoken.error.0': '短信验证码未创建',
    'imgtoken.error.-3': '图片验证码错误',
    'imgtoken.error.-2': '图片验证码为空',
    'imgtoken.error.-1': '图片验证码超时',
    'imgtoken.error.0': '图片验证码未创建',
    'request.timeout': '请求超时，请稍后重试',
    'read timed out': '请求超时，请稍后重试',
    'connect timed out': '连接超时，请稍后重试',
    'pwd.error': '密码错误',
    'signature.error': '签名错误',
    'loginid.is.null': '登陆名为空',
    'local.engine.unreachable': '本地排盘引擎连接失败(可能被系统代理或安全软件拦截),请重启应用后重试',
};

export function getErrMsg(key){
    const msg = ErrMsg[key];
    if(msg){
        return msg;
    }
    if(typeof key === 'string'){
        const lower = key.toLowerCase();
        if(lower.indexOf('timed out') >= 0 || lower.indexOf('timeout') >= 0){
            return '请求超时，请稍后重试';
        }
    }
    return key;
}
