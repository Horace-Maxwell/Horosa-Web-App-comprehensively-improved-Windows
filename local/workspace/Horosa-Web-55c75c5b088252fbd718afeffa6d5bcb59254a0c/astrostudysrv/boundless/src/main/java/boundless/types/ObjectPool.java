package boundless.types;

import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

/**
 * 对象池。线程不安全。此类是个抽象类，为具体对象池类的提供一个模板
 * @author zjf
 *
 * @param <T> 对象类型
 */
public abstract class ObjectPool<T extends ObjectPool.IReuseObject> {

	protected Map<T, Boolean> _usingObjects = new HashMap<T, Boolean>();
	protected List<T> _idleObjects = new LinkedList<T>();
	private int _optimalSize = 0;
	
	/**
	 * 构造函数
	 * @param optimalSize 最佳的大小
	 */
	public ObjectPool(int optimalSize) {
		this._optimalSize = optimalSize;
	}
	
	protected void onCreate(){
		_idleObjects.add(newObject());
	}
	
	/**
	 * 获得对象
	 * @return
	 */
    public T getObject()
    {
        T obj;
        if (_idleObjects.size() > 0)
        {
            obj = _idleObjects.get(0);
            _idleObjects.remove(0);
        }
        else obj = newObject();

        flagUsing(obj);
        obj.reset();
        return obj;
    }

    /**
     * 回收对象，供下次重复使用
     * @param obj
     */
    public void putbackObject(T obj)
    {
        if (!_usingObjects.remove(obj)) return;
        _idleObjects.add(obj);
        while (_optimalSize > 0 && _idleObjects.size() > _optimalSize)
        {
            T tempObj = _idleObjects.get(0);
            _idleObjects.remove(0);
            disposeObject(tempObj);
        }
    }

    /**
     * 销毁对象
     * @param obj
     */
    protected void disposeObject(T obj)
    {
    }

    /**
     * 把obj标志为使用中
     * @param obj
     */
    void flagUsing(T obj)
    {
        _usingObjects.put(obj, true);
    }

    /**
     * 实例化对象
     * @return
     */
    protected abstract T newObject();
    
	
	public interface IReuseObject{
		void reset();
	}

}
