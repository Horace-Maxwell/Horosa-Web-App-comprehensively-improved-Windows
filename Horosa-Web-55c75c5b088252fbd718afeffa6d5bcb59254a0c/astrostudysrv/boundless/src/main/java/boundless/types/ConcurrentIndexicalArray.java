package boundless.types;

public class ConcurrentIndexicalArray extends IndexicalArray {
	
	public ConcurrentIndexicalArray(int startIndex, int endIndex)
	{
		super(startIndex, endIndex);
	}

	/* (non-Javadoc)
	 * @see boundless.types.IndexicalArray#get(int)
	 */
	@Override
	public Object get(int index) {
		synchronized(this){
			return super.get(index);
		}
	}

	/* (non-Javadoc)
	 * @see boundless.types.IndexicalArray#set(int, java.lang.Object)
	 */
	@Override
	public void set(int index, Object value) {
		synchronized(this){
			super.set(index, value);
		}
	}

	/* (non-Javadoc)
	 * @see boundless.types.IndexicalArray#findNearest(int)
	 */
	@Override
	public int[] findNearest(int index) {
		synchronized(this){
			return super.findNearest(index);
		}
	}
	
	
}
