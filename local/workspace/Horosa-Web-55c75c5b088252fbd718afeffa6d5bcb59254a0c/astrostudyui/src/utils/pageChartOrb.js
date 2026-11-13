// 页面当前这张盘的容许度签名(逐星表 + 整体倍率)。
// 页面落 AI 快照时把它一并记下(moduleAiSnapshot 打在快照上);AI 挂载复用页面快照前,拿它与挂载自己的容许度口径比:
// 对不上 = 页面是按另一套容许度算的相位,不复用,按挂载口径重算(见 aiAnalysisContext/snapshotMatch)。
// 状态由 app.js 的状态变更回调喂进来(只存引用,签名用到时才算,同一份字段只算一次)。
import { chartOrbOverridesFromFields, chartOrbSignature } from './classicalChartGlobals';

let _fields = null;
let _memoRef;
let _memoSig = '{}';

export function notePageChartFields(fields){
	_fields = fields || null;
}

export function pageChartOrbSignature(){
	if(_fields !== _memoRef){
		_memoRef = _fields;
		try{ _memoSig = chartOrbSignature(chartOrbOverridesFromFields(_fields)); }catch(e){ _memoSig = '{}'; }
	}
	return _memoSig;
}
