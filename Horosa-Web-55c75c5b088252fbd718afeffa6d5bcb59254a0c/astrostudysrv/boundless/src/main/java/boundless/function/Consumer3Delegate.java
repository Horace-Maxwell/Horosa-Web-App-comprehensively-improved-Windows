package boundless.function;


public class Consumer3Delegate<T1, T2, T3> extends Delegate<Consumer3<T1, T2, T3>> {
	private static final long serialVersionUID = -6613541896206487983L;

	public void execute(T1 t1, T2 t2, T3 t3){
		for(Consumer3<T1, T2, T3> consumer : toArray()){
			if(consumer != null){
				consumer.accept(t1, t2, t3);
			}
		}
	}

	@Override
	protected Consumer3<T1, T2, T3>[] newArray(int length) {
		return new Consumer3[length];
	}


}
