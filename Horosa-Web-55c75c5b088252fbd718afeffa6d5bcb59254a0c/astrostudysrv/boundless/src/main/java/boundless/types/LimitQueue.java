package boundless.types;

import java.io.Serializable;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;

public class LimitQueue<T> implements Serializable {
	private static final long serialVersionUID = -9040617041558242665L;

	private Queue<T> queue;
	private int capacity;
	private T lastElem;
	
	public LimitQueue(){
		this(20);
	}
	
	public LimitQueue(int capacity){
		this.capacity = capacity;
		lastElem = null;
		this.queue = new ConcurrentLinkedQueue<T>();
	}


	synchronized public boolean enqueue(T e){
		if(this.queue.size() >= this.capacity){
			dequeue();
		}
		boolean res = this.queue.offer(e);
		if(res){
			lastElem = e;
		}
		return res;
	}
	
	synchronized public T dequeue(){
		T res = this.queue.poll();
		if(res == null){
			lastElem = null;
		}
		return res;
	}
	
	public T peek(){
		return this.queue.peek();
	}
	
	public T last(){
		return this.lastElem;
	}
	
	
}
