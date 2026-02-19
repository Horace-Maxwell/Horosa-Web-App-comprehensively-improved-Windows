package boundless.types.mq.rabbitmq;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

import boundless.types.mq.MsgQueue;

import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Consumer;
import com.rabbitmq.client.DefaultConsumer;
import com.rabbitmq.client.Envelope;
import com.rabbitmq.client.AMQP;
import com.rabbitmq.client.MessageProperties;

public class RabbitMQ implements MsgQueue {
	private String name; //队列名，或exchange名
	private Channel channel;
	private boolean durable;
	private long msgExpires;
	private long queueExpires;
	private long maxlength;
	private Map<String, Object> queueargs = new HashMap<String, Object>();

	RabbitMQ(Channel channel, String name, boolean durable, long msgexpires, long queueexpires, long maxlength){
		this.channel = channel;
		this.name = name;
		this.durable = durable;
		this.msgExpires = msgexpires * 1000;
		if(this.msgExpires > 0){
			queueargs.put("x-message-ttl", this.msgExpires);
		}
		this.queueExpires = queueexpires * 1000;
		if(this.queueExpires > 0){
			queueargs.put("x-expires", this.queueExpires);
		}
		this.maxlength = maxlength;
		if(this.maxlength > 0){
			queueargs.put("x-max-length", this.maxlength);
		}
		if(this.queueargs.isEmpty()){
			this.queueargs = null;
		}
	}

	public String getName(){
		return this.name;
	}
	
	@Override
	public void close() {
		try{
			channel.close();
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}

	@Override
	public void publish(String msg) {
		try{
			channel.queueDeclare(this.name, this.durable, false, false, queueargs);
			channel.exchangeDeclare(this.name, "fanout", durable);
			if(this.durable){
				channel.basicPublish(this.name, this.name, MessageProperties.PERSISTENT_TEXT_PLAIN, msg.getBytes("UTF-8"));
			}else{
				channel.basicPublish(this.name, this.name, null, msg.getBytes("UTF-8"));
			}
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	@Override
	public void subscribe(java.util.function.Consumer<String> handler, java.util.function.Consumer<Exception> exhandler) {
		try {
			channel.queueDeclare(this.name, this.durable, false, false, queueargs);
			channel.exchangeDeclare(this.name, "fanout", durable);
			channel.queueBind(this.name, this.name, "");
			Consumer consumer = new DefaultConsumer(channel) {
				@Override
				public void handleDelivery(String consumerTag, Envelope envelope, AMQP.BasicProperties properties, byte[] body)
						throws IOException {
					try{
						String message = new String(body, "UTF-8");
						handler.accept(message);
					}catch(Exception e){
						exhandler.accept(e);
					}
				}
			};
			
			channel.basicConsume(this.name, false, consumer);
		} catch (IOException e) {
			exhandler.accept(e);
		}

	}
	
	@Override
	public void enqueue(String msg){
		try{
			channel.queueDeclare(this.name, this.durable, false, false, queueargs);
			if(this.durable){
				channel.basicPublish("", this.name, MessageProperties.PERSISTENT_TEXT_PLAIN, msg.getBytes("UTF-8"));
			}else{
				channel.basicPublish("", this.name, null, msg.getBytes("UTF-8"));
			}
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	@Override
	public boolean dequeue(java.util.function.Consumer<String> handler, java.util.function.Consumer<Exception> exhandler){
		try {
			channel.queueDeclare(this.name, this.durable, false, false, queueargs);
			channel.basicQos(0);
			
			Consumer consumer = new DefaultConsumer(channel) {
				@Override
				public void handleDelivery(String consumerTag, Envelope envelope, AMQP.BasicProperties properties, byte[] body)
						throws IOException {
					try{
						String message = new String(body, "UTF-8");
						handler.accept(message);
					}catch(Exception e){
						exhandler.accept(e);
					}
				}
			};
			
			channel.basicConsume(this.name, false, consumer);
		} catch (IOException e) {
			exhandler.accept(e);
		}
		return true;
	}
	
	@Override
	public void publish(String topickey, String msg) {
		try{
			channel.queueDeclare(this.name, this.durable, false, false, queueargs);
			channel.exchangeDeclare(this.name, "topic", durable);
			if(this.durable){
				channel.basicPublish(this.name, topickey, MessageProperties.PERSISTENT_TEXT_PLAIN, msg.getBytes("UTF-8"));
			}else{
				channel.basicPublish(this.name, topickey, null, msg.getBytes("UTF-8"));
			}
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	@Override
	public void subscribe(String topickey, java.util.function.Consumer<String> handler, java.util.function.Consumer<Exception> exhandler) {
		try {
			channel.queueDeclare(this.name, this.durable, false, false, queueargs);
			channel.exchangeDeclare(this.name, "topic", durable);
			channel.queueBind(this.name, this.name, topickey);
			Consumer consumer = new DefaultConsumer(channel) {
				@Override
				public void handleDelivery(String consumerTag, Envelope envelope, AMQP.BasicProperties properties, byte[] body)
						throws IOException {
					try{
						String message = new String(body, "UTF-8");
						handler.accept(message);
					}catch(Exception e){
						exhandler.accept(e);
					}
				}
			};
			
			channel.basicConsume(this.name, false, consumer);
		} catch (IOException e) {
			exhandler.accept(e);
		}

	}
	
	@Override
	public void publish(String exname, String topickey, String msg) {
		try{
			channel.queueDeclare(this.name, this.durable, false, false, queueargs);
			channel.exchangeDeclare(exname, "topic", durable);
			if(this.durable){
				channel.basicPublish(exname, topickey, MessageProperties.PERSISTENT_TEXT_PLAIN, msg.getBytes("UTF-8"));
			}else{
				channel.basicPublish(exname, topickey, null, msg.getBytes("UTF-8"));
			}
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	@Override
	public void subscribe(String exname, String topickey, java.util.function.Consumer<String> handler, java.util.function.Consumer<Exception> exhandler) {
		try {
			channel.queueDeclare(this.name, this.durable, false, false, queueargs);
			channel.exchangeDeclare(exname, "topic", durable);
			channel.queueBind(this.name, exname, topickey);
			Consumer consumer = new DefaultConsumer(channel) {
				@Override
				public void handleDelivery(String consumerTag, Envelope envelope, AMQP.BasicProperties properties, byte[] body)
						throws IOException {
					try{
						String message = new String(body, "UTF-8");
						handler.accept(message);
					}catch(Exception e){
						exhandler.accept(e);
					}
				}
			};
			
			channel.basicConsume(this.name, false, consumer);
		} catch (IOException e) {
			exhandler.accept(e);
		}

	}
	
	
}
