package boundless.function;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;

public abstract class Delegate<T> implements Serializable {
	private List<T> _list = new LinkedList<T>();

	public void add(T delegate){
    	synchronized(_list){
    		_list.add(delegate);
    	}		
	}
	
	public void remove(T delegate){
    	synchronized(_list){
    		_list.remove(delegate);
    	}		
	}
	
	public void clear() {
    	synchronized(_list){
    		_list.clear();
    	}		
	}
	
	protected T[] toArray(){
		T[] consumers = null;
		synchronized(_list){
			consumers = newArray(_list.size());
			_list.toArray(consumers);
		}
		return consumers;
	}
	
	/**
	 * 子类必须实现这个方法，来生成回调函数的数组。
	 * @param length 需要的数组长度
	 * @return
	 */
	abstract protected T[] newArray(int length);

}
