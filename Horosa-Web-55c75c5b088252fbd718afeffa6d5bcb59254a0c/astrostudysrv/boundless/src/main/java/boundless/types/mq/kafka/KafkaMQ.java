package boundless.types.mq.kafka;

import java.util.function.Consumer;

import org.apache.kafka.clients.producer.Producer;

import boundless.types.mq.MsgQueue;

public class KafkaMQ implements MsgQueue {
	private String groupId;
	private Producer<String, String> producer;
	private org.apache.kafka.clients.consumer.Consumer<String, String> consumer;

	public KafkaMQ(Producer<String, String> producer, org.apache.kafka.clients.consumer.Consumer<String, String> consumer, String groupId){
		this.producer = producer;
		this.consumer = consumer;
		this.groupId = groupId;
	}
	
	@Override
	public void close() {
		this.consumer.close();
	}

	@Override
	public void publish(String msg) {
		// TODO Auto-generated method stub

	}

	@Override
	public void subscribe(Consumer<String> handler,
			Consumer<Exception> exhandler) {
		// TODO Auto-generated method stub

	}

}
