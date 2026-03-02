package test.threading;

import boundless.threading.*;

public class TickThreadTest {
	public static void main(String args[]) throws Exception {
		TickThread mainThread=new TickThread();
		mainThread.start();
		mainThread.addTicker(new TestTicker());
		
		System.out.println("press any key to stop");
		System.in.read();
	}
}

class TestTicker implements ITicker{

	@Override
	public void tick() {
		TickThread childThread=new TickThread();
		childThread.start();
		
		childThread.queueWork(()->{
			return "hello";
		});
		
		childThread.queueWork(()->{
			return "hello1";
		},(result)->{
			System.out.println(result);
		});
		
		TickThread.current().removeTicker(this);
	}
}
