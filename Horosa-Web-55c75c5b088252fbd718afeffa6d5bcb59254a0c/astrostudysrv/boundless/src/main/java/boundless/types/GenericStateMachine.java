package boundless.types;

import java.util.HashMap;
import java.util.Map;

import boundless.function.Consumer0;
import boundless.function.Consumer2;
import boundless.function.Consumer2Delegate;
import boundless.function.Consumer0Delegate;

/**
 * 泛型状态机。支持状态可以包含子状态
 * @param <T_StateCode> 状态代码类型
 * @author zjf
 *
 */
public class GenericStateMachine<T_StateCode> implements IDisposable {
	
	/**
	 * 可转换状态表
	 */
	private Map<T_StateCode, IGenericState<T_StateCode>> _states = new HashMap<T_StateCode, IGenericState<T_StateCode>>();

	/**
	 * 当前状态
	 */
	protected IGenericState<T_StateCode> _currentState;
	
	/**
	 * 是否要对状态变换做可变换检查。true:检查,false:不检查
	 */
	protected boolean _transformValidateEnabled;
	
	/**
	 * 状态变更前事件处理方法
	 */
	private Consumer2Delegate<Object, GenericStateMachine<T_StateCode>.GenericStateCancelEventArgs<T_StateCode>> onBeforeStateChanged 
		= new Consumer2Delegate<Object, GenericStateMachine<T_StateCode>.GenericStateCancelEventArgs<T_StateCode>>();
	
	/**
	 * 状态变更后事件处理方法
	 */
	private Consumer2Delegate<Object, GenericStateMachine<T_StateCode>.GenericStateChangeEventArgs<T_StateCode>> onAfterStateChanged 
		= new Consumer2Delegate<Object, GenericStateMachine<T_StateCode>.GenericStateChangeEventArgs<T_StateCode>>();
	
	/**
	 * 状态结束事件
	 */
	private Consumer0Delegate onStateCompleted = new Consumer0Delegate();
	
	public GenericStateMachine() {
		_transformValidateEnabled = true;
	}
	
	public void addOnBeforeStateChanged(Consumer2<Object, GenericStateMachine<T_StateCode>.GenericStateCancelEventArgs<T_StateCode>> consumer){
		this.onBeforeStateChanged.add(consumer);
	}
	
	public void addOnAfterStateChanged(Consumer2<Object, GenericStateMachine<T_StateCode>.GenericStateChangeEventArgs<T_StateCode>> consumer){
		this.onAfterStateChanged.add(consumer);
	}
	
	public void addOnStateCompleted(Consumer0 consumer){
		this.onStateCompleted.add(consumer);
	}

	/**
	 * 提供一个初始化状态
	 * @param state
	 */
    public void initState(IGenericState<T_StateCode> state)
    {
        _currentState = state;
    }

    /**
     * 添加可变换的状态
     * @param state
     */
    public void putSate(IGenericState<T_StateCode> state)
    {
        _states.put(state.getStateCode(), state);
    }
    
    /**
     * 
     * @param stateCode
     * @return
     */
    public IGenericState<T_StateCode> getSate(T_StateCode stateCode)
    {
        if (!_states.containsKey(stateCode)) return null;
        return _states.get(stateCode);
    }
    
    
    public boolean getTransformValidateEnabled(){
    	return this._transformValidateEnabled;
    }
    
    public void setTransformValidateEnabled(boolean flag){
    	this._transformValidateEnabled = flag;
    }
 
    /**
     * 把当前状态变迁到新状态。新状态与当前状态是平级关系
     * @param stateCode 状态代码
     * @param stateArgs 状态参数,用于状态初始化时可能需要的参数
     * @return true:状态变更成功,false:状态变更失败
     */
    public boolean changeState(T_StateCode stateCode, Object stateArgs)
    {
        return changeState(stateCode,stateArgs,null);
    }
    
    /**
     * 把当前状态变迁到新状态。新状态与当前状态是平级关系
     * @param stateCode 状态代码
     * @param stateArgs 状态参数,用于状态初始化时可能需要的参数
     * @param callbackCollection 新状态运行过程中回调的方法
     * @return true:状态变更成功,false:状态变更失败
     */
    public boolean changeState(T_StateCode stateCode, Object stateArgs, GenericStateCallbackCollection callbackCollection)
    {
        IGenericState<T_StateCode> oldState = _currentState;
        IGenericState<T_StateCode> newState = null;
        if (_currentState != null)
        {
            if (getTransformValidateEnabled() && !_currentState.canTransform(stateCode)) return false;
            newState = _currentState.getTransformState(stateCode);
            if (newState == null)
            {
                if (_currentState.canUntransform(stateCode)) return false;
                newState = getSate(stateCode);
            }
            if (newState == null) return false;

            //判断是否可以转换状态
            GenericStateCancelEventArgs<T_StateCode> e = 
            		new GenericStateCancelEventArgs<T_StateCode>(newState, stateArgs);
            excuteBeforeStateChangedEvent(this, e);
            if (e.isCanceled()) return false;
        }
        else
        {
            newState = getSate(stateCode);
        }

        if (newState == null) return false;
        _currentState = newState;

        if (oldState != null)
        {
            oldState.stop();
        }

        _currentState.reset(stateArgs, callbackCollection);
        excuteAfterStateChangedEvent(this, new GenericStateChangeEventArgs<T_StateCode>(oldState, newState, stateArgs));
        _currentState.start();
        return true;
    }


    /**
     * 使当前状态陷入到新状态。
     * 如果当前状态的子状态里包含新状态，则当前状态的当前子状态变迁为新状态，此时新状态与当前状态是父子关系
     * 如果当前状态的子状态里不包含新状态，则当前状态变迁为新状态，此时新状态与当前状态是平级关系
     * @param stateCode
     * @param stateArgs
     * @return
     */
    public Boolean plungeState(T_StateCode stateCode, Object stateArgs)
    {
        if (_currentState != null)
        {
        	Boolean stateResult = _currentState.plungeState(stateCode, stateArgs, null);
            if (stateResult != null) return stateResult;
        }
        return changeState(stateCode, stateArgs, null);
    }
    
    /**
     * 获得当前状态
     * @return
     */
    public IGenericState<T_StateCode> getCurrentState(){
    	return this._currentState;
    }
    
    /**
     * 获得状态列表
     * @return
     */
    public IGenericState<T_StateCode>[] getStates(){
    	IGenericState<T_StateCode>[] res = new IGenericState[_states.size()];
    	return _states.values().toArray(res);
    }
    
    /**
     * 执行状态变更前处理方法
     * @param sender
     * @param e
     */
    protected void excuteBeforeStateChangedEvent(Object sender, GenericStateCancelEventArgs<T_StateCode> e)
    {
        if (onBeforeStateChanged != null)
        {
            onBeforeStateChanged.execute(sender, e);
        }
    }

    /**
     * 执行状态变更后处理方法
     * @param sender
     * @param e
     */
    protected void excuteAfterStateChangedEvent(Object sender, GenericStateChangeEventArgs<T_StateCode> e)
    {
        if (onAfterStateChanged != null)
        {
            onAfterStateChanged.execute(sender, e);
        }
    }
    
    /**
     * 
     */
    protected void excuteStateCompletedEvent()
    {
        if (onStateCompleted != null)
        {
            onStateCompleted.execute();
        }
    }
    
	@Override
	public void dispose() {
		this.getCurrentState().stop();
		for(IGenericState<T_StateCode> state : _states.values()){
			state.dispose();
		}
	}
	
	
	/**
	 * 提供可取消的状态事件
	 * @author zjf
	 *
	 * @param <T_StateCode>
	 */
	public class GenericStateCancelEventArgs<T_StateCode> extends CancelEventArgs{
		private Object _newStateArgs;
		private IGenericState<T_StateCode> _newStatus;
		
		public GenericStateCancelEventArgs(IGenericState<T_StateCode> newState, Object newStateArgs){
			this._newStatus = newState;
			this._newStateArgs = newStateArgs;
		}
		
		public Object getNewStateArgs(){
			return _newStateArgs;
		}
		
		public IGenericState<T_StateCode> getNewState(){
			return _newStatus;
		}
		
	}
	
	
	/**
	 * 提供状态改变事件
	 * @author zjf
	 *
	 * @param <T_StateCode>
	 */
	public class GenericStateChangeEventArgs<T_StateCode> extends EventArgs {
		private IGenericState<T_StateCode> _oldStatus;
		private IGenericState<T_StateCode> _newStatus;
		private Object _newStateArgs;
		
		public GenericStateChangeEventArgs(IGenericState<T_StateCode> oldState, IGenericState<T_StateCode> newState,
				Object newStateArgs){
			this._oldStatus = oldState;
			this._newStatus = newState;
			this._newStateArgs = newStateArgs;
		}
		
		public IGenericState<T_StateCode> getOldStatus(){
			return _oldStatus;
		}
		
		public IGenericState<T_StateCode> getNewStatus(){
			return _newStatus;
		}
		
		public Object getNewStateArgs(){
			return _newStateArgs;
		}
		
	}
	

}
