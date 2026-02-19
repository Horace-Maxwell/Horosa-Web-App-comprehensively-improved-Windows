package boundless.types;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;

/**
 * 抽象状态
 * @author zjf
 *
 * @param <T_StateCode>
 */
public class AbstractGenericState<T_StateCode> implements IGenericState<T_StateCode> {
	
	protected GenericStateCallbackCollection _callbackCollection;
	
	/**
	 * 状态开始时间
	 */
	protected Date _startTime;
	
	/**
	 * 可转换状态表
	 */
	protected Map<T_StateCode, IGenericState<T_StateCode>>  _transformStates = new HashMap<T_StateCode, IGenericState<T_StateCode>>();

	/**
	 * 不可转换状态表
	 */
	protected Map<T_StateCode, Boolean> _untransformStateCodes = new HashMap<T_StateCode, Boolean>();
	
	/**
	 * 状态码
	 */
	protected T_StateCode _stateCode;
	
	public AbstractGenericState() {
	}

	@Override
	public void dispose() {
		_callbackCollection = null;
	}

	/**
	 * 获得状态代码
	 * @return
	 */
	@Override
	public T_StateCode getStateCode() {
		return _stateCode;
	}

	/**
	 * 添加可变换的状态
	 * @param state
	 */
	@Override
	public void addTransformState(IGenericState<T_StateCode> state) {
        if (state != null && !_transformStates.containsKey(state.getStateCode()))
        {
            _transformStates.put(state.getStateCode(), state);
        }
		
	}

	/**
	 * 移除可变换的状态
	 * @param state
	 */
	@Override
	public void removeTransformState(IGenericState<T_StateCode> state) {
        if (state != null && _transformStates.containsKey(state.getStateCode()))
        {
            _transformStates.remove(state.getStateCode());
        }
		
	}

	/**
	 * 是否可转换状态
	 * @param stateCode
	 * @return
	 */
	@Override
	public boolean canTransform(T_StateCode stateCode) {
		return _transformStates.containsKey(stateCode);
	}

	/**
	 * 获得可以转换到的状态
	 * @param stateCode
	 * @return
	 */
	@Override
	public IGenericState<T_StateCode> getTransformState(T_StateCode stateCode) {
        IGenericState<T_StateCode> state = _transformStates.get(stateCode);
        return state;
	}

	/**
	 * 添加不可变换的状态
	 * @param stateCode
	 */
	@Override
	public void addUntransformState(T_StateCode stateCode) {
		_untransformStateCodes.put(stateCode, Boolean.valueOf(true));
	}

	/**
	 * 移除不可变换的状态
	 * @param stateCode
	 */
	@Override
	public void removeUntransformState(T_StateCode stateCode) {
        if (_untransformStateCodes.containsKey(stateCode))
        {
            _untransformStateCodes.remove(stateCode);
        }
	}

	/**
	 * 是否不可转换状态
	 * @param stateCode
	 * @return
	 */
	@Override
	public boolean canUntransform(T_StateCode stateCode) {
        return _untransformStateCodes.containsKey(stateCode);
	}

	/**
	 * 重设
	 * @param args
	 * @param callbackCollection
	 */
	@Override
	public void reset(Object args, GenericStateCallbackCollection callbackCollection) {
        this._callbackCollection = callbackCollection;		
	}

	/**
	 * 启动状态
	 */
	@Override
	public void start() {
        _startTime = new Date();
        raiseBeginCallback();		
	}

	/**
	 * 状态停止
	 */
	@Override
	public void stop() {
		
	}
	
	/**
	 * 使当前子状态陷入到新状态。<br>
	 * 如果当前子状态里包含新状态，则尝试把当前子状态变迁为新状态，此时新状态与当前子状态是父子关系。
	 * 如果当前子状态的子状态里不包含新状态，则返回null
	 * @param stateCode
	 * @param stateArgs
	 * @param callbackCollection
	 * @return null：子状态里不包含新状态,false：状态变迁失败
	 */
	@Override
	public Boolean plungeState(T_StateCode stateCode, Object stateArgs,
			GenericStateCallbackCollection callbackCollection) {
		return null;
	}
	
	/**
	 * 触发回调正在执行方法
	 */
    protected void raiseBeginCallback()
    {
        try
        {
            if (this._callbackCollection != null && this._callbackCollection.onBegin != null) 
            	this._callbackCollection.onBegin.execute(this, new EventArgs());
        }
        catch (Exception ex) { }
    }

    /**
     * 触发回调正在执行方法
     */
    protected void raiseProcessCallback()
    {
        try
        {
            if (this._callbackCollection != null && this._callbackCollection.onProcess != null) 
            	this._callbackCollection.onProcess.execute(this, new EventArgs());
        }
        catch (Exception ex) { }
    }
    
    /**
     * 触发回调结束执行方法
     */
    protected void raiseEndCallback()
    {
        try
        {
            if (this._callbackCollection != null && this._callbackCollection.onEnd != null) 
            	this._callbackCollection.onEnd.execute(this, new EventArgs());
        }
        catch (Exception ex) { }
    }

}
