package boundless.types;

import boundless.utility.JsonUtility;

public class Tuple<T1, T2> {
	private T1 item1;
	private T2 item2;
	
	public Tuple(T1 t1, T2 t2){
		item1 = t1;
		item2 = t2;
	}
	
	public T1 item1(){return item1;}
	public T2 item2(){return item2;}
	
	public void item1(T1 v){
		item1 = v;
	}
	
	public void item2(T2 v){
		item2 = v;
	}
	
	public String toString(){
		return JsonUtility.encode(this);
	}
}
