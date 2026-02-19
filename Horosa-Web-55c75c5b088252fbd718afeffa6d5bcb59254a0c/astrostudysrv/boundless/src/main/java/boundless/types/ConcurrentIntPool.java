package boundless.types;

/**
 * Int值的池。线程安全。
 * 用于产生一个临时Int值，此Int值在已使用中的是唯一的，用完后再回收。
 * @author zjf
 *
 */
public class ConcurrentIntPool extends IntPool {

	public ConcurrentIntPool(int optimalSize) {
		super(optimalSize);
	}

	public ConcurrentIntPool(int optimalSize, int[] values) {
		super(optimalSize, values);
	}

	/* (non-Javadoc)
	 * @see boundless.types.IntPool#getValue()
	 */
	@Override
	public int getValue() {
		synchronized(this){
			return super.getValue();
		}
	}

	/* (non-Javadoc)
	 * @see boundless.types.IntPool#putback(int)
	 */
	@Override
	public void putback(int value) {
		synchronized(this){
			super.putback(value);
		}
	}

	/* (non-Javadoc)
	 * @see boundless.types.IntPool#isUsing(int)
	 */
	@Override
	public boolean isUsing(int value) {
		synchronized(this){
			return super.isUsing(value);
		}
	}

	
}
