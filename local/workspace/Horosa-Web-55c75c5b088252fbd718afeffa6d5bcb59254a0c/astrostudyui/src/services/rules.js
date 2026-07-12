import request from '../utils/request';
import {ServerRoot} from '../utils/constants';
import { ziweiRulesCacheEnabled } from '../utils/perfFlags';

export function ziweirules(values){
    return request(`${ServerRoot}/ziwei/rules`, {
        body: JSON.stringify(values),
    });
}

// 紫微 rules 会话级缓存(流畅度):rules 与本盘无关(body 恒 {};流派四化走 /ziwei/birth 的
// params.sihua),会话内静态 → 启动 prime(models/app.js dispatch rules/ziwei)后,排盘路径
// 全部内存命中,消掉 requestZiWei 的第二次 RTT。
// - 按 body 字符串分键:后端将来带参也天然正确;
// - 缓存 Promise 即 inflight 去重:并发首排只发一次;
// - 失败从缓存剔除:下次照常重试,错误不被缓存。
// - 🔴 空载荷同样视为失败剔除:request() 网络层失败会「吞错 resolve undefined」(非 reject),
//   若把 undefined 当成功缓存 = 整个会话投毒(App 启动时后端温启动中,prime 必踩)——
//   消费端 rules[ResultKey] 永远崩、紫微左栏选项永远选不中。缓存只允许存「有效载荷」。
const ZIWEI_RULES_CACHE = new Map();

export function ziweirulesCached(values){
    if(!ziweiRulesCacheEnabled()){
        // kill-switch:直通请求,行为==现状。
        return ziweirules(values);
    }
    const key = JSON.stringify(values || {});
    const hit = ZIWEI_RULES_CACHE.get(key);
    if(hit){
        return hit;
    }
    const promise = ziweirules(values).then((data)=>{
        if(data === undefined || data === null){
            // 吞错型失败(见头注):剔缓存 + 转成真异常,交调用侧既有失败路径;下次调用自然重试。
            if(ZIWEI_RULES_CACHE.get(key) === promise){
                ZIWEI_RULES_CACHE.delete(key);
            }
            throw new Error('ziwei rules 响应为空(后端可能尚未就绪)');
        }
        return data;
    }, (err)=>{
        if(ZIWEI_RULES_CACHE.get(key) === promise){
            ZIWEI_RULES_CACHE.delete(key);
        }
        throw err;
    });
    ZIWEI_RULES_CACHE.set(key, promise);
    return promise;
}

// 预留:若未来出现 rules 编辑/刷新入口,调用此函数失效缓存。
export function clearZiweiRulesCache(){
    ZIWEI_RULES_CACHE.clear();
}
