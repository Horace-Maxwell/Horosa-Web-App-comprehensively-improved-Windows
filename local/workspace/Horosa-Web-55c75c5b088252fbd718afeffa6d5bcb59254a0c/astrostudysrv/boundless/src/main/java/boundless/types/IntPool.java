package boundless.types;

import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

/**
 * Int值的池。线程不安全。
 * 用于产生一个临时Int值，此Int值在已使用中的是唯一的，用完后再回收
 * @author zjf
 *
 */
public class IntPool {
	
	private Map<Integer, IntObject> _usingValues = new HashMap<Integer, IntObject>();
	private IntObjectPool _pool; 
	private int _startValue;
	
	public IntPool(int optimalSize) {
		this(optimalSize, null);
	}
	
	/**
	 * 
	 * @param optimalSize 最佳的大小
	 * @param values 把values标志为使用中
	 */
    public IntPool(int optimalSize, int[] values)
    {
        this._pool = new IntObjectPool(optimalSize);
        Map<Integer, Boolean> uniqueValues = new HashMap<Integer, Boolean>();

        for (int i = 0; values!=null && i < values.length; i++)
        {
            uniqueValues.put(values[i], true);
        }

        for(Integer key : uniqueValues.keySet()){
        	this._pool.flagUsing(new IntObject(key));
        }
    }
    
    public int getStartValue(){
    	return _startValue;
    }
    
    public void setStartValue(int value){
    	this._startValue = value;
    }
    
    /**
     * 获得Int值
     */
    public int getValue()
    {
        IntObject obj = _pool.getObject();
        _usingValues.put(obj.id, obj);
        return obj.id + getStartValue();
    }
    
    /**
     * 回收Int值，供下次重复使用
     * @param value
     */
    public void putback(int value)
    {
        value = value - getStartValue();
        IntObject obj = _usingValues.get(value);

        if (obj == null) return;
        
        _usingValues.remove(value);
        _pool.putbackObject(obj);
    }

    /**
     * 是否再使用中
     * @param value
     * @return
     */
    public boolean isUsing(int value)
    {
        value = value - getStartValue();
        IntObject obj;
        return _usingValues.containsKey(value);
    }

	
	private class IntObject implements ObjectPool.IReuseObject{
        public IntObject(int id)
        {
            this.id = id;
        }

        public int id;

        public void reset()
        {
        }
		
	}
	
	private class IntObjectPool extends ObjectPool<IntObject>{
		private int _totalCount = 0;
		private List<IntObject> _disposeObjects = new LinkedList<IntObject>();
		
		public IntObjectPool(int optimalSize){
			super(optimalSize);
		}
		
		@Override
        protected IntObject newObject()
        {
            if (_disposeObjects.size() > 0)
            {
                IntObject result = _disposeObjects.get(0);
                _disposeObjects.remove(0);
                return result;
            }
            
            int newId = ++_totalCount;
            
            for(IntObject key : _usingObjects.keySet()){
            	if(key.id == newId){
            		newId = ++_totalCount;
            	}
            }
                        
            return new IntObject(newId);
        }

		@Override
        protected void disposeObject(IntObject obj)
        {
            super.disposeObject(obj);
            _disposeObjects.add(obj);
        }
		
	}

}
