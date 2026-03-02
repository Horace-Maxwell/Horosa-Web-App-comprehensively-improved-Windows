package boundless.types;

public abstract class ConcurrentObjectPool<T extends ObjectPool.IReuseObject> extends ObjectPool<T> {
	
	public ConcurrentObjectPool(int optimalSize){
		super(optimalSize);
	}

	/* (non-Javadoc)
	 * @see boundless.types.ObjectPool#getObject()
	 */
	@Override
	public T getObject() {
		synchronized(this){
			return super.getObject();
		}
	}

	/* (non-Javadoc)
	 * @see boundless.types.ObjectPool#putbackObject(boundless.types.ObjectPool.IReuseObject)
	 */
	@Override
	public void putbackObject(T obj) {
		synchronized(this){
			super.putbackObject(obj);
		}
	}
	
	
}
