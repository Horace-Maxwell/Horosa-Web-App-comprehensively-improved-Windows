package boundless.function;


public class Consumer2Delegate<T1, T2> extends Delegate<Consumer2<T1, T2>> {
	private static final long serialVersionUID = 6269051655315654572L;

	public void execute(T1 t1, T2 t2){
		for(Consumer2<T1, T2> consumer : toArray()){
			if(consumer != null){
				consumer.accept(t1, t2);
			}
		}
	}

	@Override
	protected Consumer2<T1, T2>[] newArray(int length) {
		return new Consumer2[length];
	}

	
}
