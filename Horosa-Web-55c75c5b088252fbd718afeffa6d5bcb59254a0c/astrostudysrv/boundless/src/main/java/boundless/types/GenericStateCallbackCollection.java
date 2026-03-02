package boundless.types;

import boundless.function.Consumer2Delegate;

public class GenericStateCallbackCollection {

	public GenericStateCallbackCollection() {
	}

	/**
	 * 状态开始执行时调用
	 */
	Consumer2Delegate onBegin = new Consumer2Delegate();
	
	/**
	 * 状态执行过程中不断地调用
	 */
	Consumer2Delegate onProcess = new Consumer2Delegate();
	
	/**
	 * 状态结束时调用
	 */
	Consumer2Delegate onEnd = new Consumer2Delegate();
	
}
