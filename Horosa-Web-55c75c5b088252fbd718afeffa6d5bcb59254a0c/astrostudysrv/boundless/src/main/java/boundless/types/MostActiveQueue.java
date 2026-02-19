package boundless.types;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Queue;
import java.util.Set;

public class MostActiveQueue<T> implements Serializable {
	private static final long serialVersionUID = -2536935036643586117L;

	private int capacity;
	private Queue<T> queue;
	private Set<T> elems;

	public MostActiveQueue(int capacity){
		this.capacity = capacity;
		this.queue = new LinkedList<T>();
		this.elems = new HashSet<T>();
	}
	
	public MostActiveQueue(){
		this(20);
	}
	
	synchronized public void enqueue(T obj){
		if(this.elems.contains(obj)){
			return;
		}
		if(this.queue.size() >= this.capacity){
			T ele = this.queue.poll();
			this.elems.remove(ele);
		}
		this.queue.add(obj);
		this.elems.add(obj);
	}
	
	synchronized public boolean remove(T obj){
		this.elems.remove(obj);
		return this.queue.remove(obj);
	}
	
	synchronized public T dequeue(){
		T ele = this.queue.poll();
		this.elems.remove(ele);
		return ele;
	}
	
	synchronized public void clear(){
		this.queue.clear();
		this.elems.clear();
	}
	
	synchronized public List<T> allObjects(){
		List<T> res = new ArrayList<T>(capacity);
		res.addAll(this.queue);
		return res;
	}
}
