package boundless.types;

/**
 * 状态机的状态。状态具有父子性，每个状态可以包含子状态
 * @author zjf
 *
 */
public interface IGenericState<T_StateCode> extends IDisposable {
	/**
	 * 获得状态代码
	 * @return
	 */
	T_StateCode getStateCode();
	
	/**
	 * 添加可变换的状态
	 * @param state
	 */
	void addTransformState(IGenericState<T_StateCode> state);
	
	/**
	 * 移除可变换的状态
	 * @param state
	 */
	void removeTransformState(IGenericState<T_StateCode> state);
	
	/**
	 * 是否可转换状态
	 * @param stateCode
	 * @return
	 */
	boolean canTransform(T_StateCode stateCode);
	
	/**
	 * 获得可以转换到的状态
	 * @param stateCode
	 * @return
	 */
	IGenericState<T_StateCode> getTransformState(T_StateCode stateCode);
	
	/**
	 * 添加不可变换的状态
	 * @param stateCode
	 */
	void addUntransformState(T_StateCode stateCode);
	
	/**
	 * 移除不可变换的状态
	 * @param stateCode
	 */
	void removeUntransformState(T_StateCode stateCode);
	
	/**
	 * 是否不可转换状态
	 * @param stateCode
	 * @return
	 */
	boolean canUntransform(T_StateCode stateCode);
	
	/**
	 * 重设
	 * @param args
	 * @param callbackCollection
	 */
	void reset(Object args, GenericStateCallbackCollection callbackCollection);
	
	/**
	 * 启动状态
	 */
	void start();
	
	/**
	 * 状态停止
	 */
	void stop();
	
	/**
	 * 使当前子状态陷入到新状态。<br>
	 * 如果当前子状态里包含新状态，则尝试把当前子状态变迁为新状态，此时新状态与当前子状态是父子关系。
	 * 如果当前子状态的子状态里不包含新状态，则返回null
	 * @param stateCode
	 * @param stateArgs
	 * @param callbackCollection
	 * @return null：子状态里不包含新状态,false：状态变迁失败
	 */
	Boolean plungeState(T_StateCode stateCode, Object stateArgs, GenericStateCallbackCollection callbackCollection);

}
