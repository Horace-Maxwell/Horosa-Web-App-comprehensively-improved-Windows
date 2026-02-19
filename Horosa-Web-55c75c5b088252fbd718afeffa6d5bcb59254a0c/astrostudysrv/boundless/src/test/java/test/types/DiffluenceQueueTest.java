package test.types;

import boundless.types.DiffluenceQueue;

public class DiffluenceQueueTest {

	public DiffluenceQueueTest() {

	}

	public static void main(String[] args){
		DiffluenceQueue.AbstractDiffluenceQueueAssistant<TestItem> assistant=new DiffluenceQueue.AbstractDiffluenceQueueAssistant<TestItem>((items)->{
			System.out.println(items[0].Field0);
			return new boolean[]{true};
		}){
			@Override
			public TestItem[] newArray(int size) {
				return new TestItem[size];
			}
		};
		assistant.bufferCount(1);
		DiffluenceQueue<TestItem> queue = new DiffluenceQueue<TestItem>(assistant);
		
		queue.start();
		
		TestItem item = new TestItem();
		queue.enqueue(item);
	}
	
	
	private static class TestItem implements DiffluenceQueue.IDiffluenceQueueItem{
		public String Field0 = "xxxx";

		@Override
		public Object itemType() {
			return "testxxxx";
		}

		@Override
		public boolean noDelay() {
			return true;
		}
	}
	
}
