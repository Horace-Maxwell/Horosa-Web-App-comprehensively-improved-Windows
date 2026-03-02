package boundless.types;

public class OutParameter<T> {
	public T value = null;
	
	public OutParameter(T t) {
		value = t;
	}
	
	public OutParameter() { }
}
