package boundless.function;

import java.util.function.Consumer;


public class ConsumerDelegate<T> extends Delegate<Consumer<T>> {
	private static final long serialVersionUID = -7572898831035957464L;

	public void execute(T t){
		for(Consumer<T> consumer : toArray()){
			if(consumer != null){
				try{
					consumer.accept(t);
				}catch(Exception e){
				}
			}
		}
	}

	@Override
	protected Consumer<T>[] newArray(int length) {
		return new Consumer[length];
	}


}
