package boundless.types;

public class Tuple3<T1, T2, T3> extends Tuple<T1, T2> {
	private T3 item3;
	
	public Tuple3(T1 t1, T2 t2, T3 t3) {
		super(t1, t2);
		item3 = t3;
	}

	public T3 item3(){
		return item3;
	}
	
	public void item3(T3 v){
		item3 = v;
	}
	
}
