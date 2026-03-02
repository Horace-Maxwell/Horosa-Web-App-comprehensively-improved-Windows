package boundless.types.mq.sqs;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Set;
import java.util.function.Consumer;

import com.amazonaws.services.sqs.AmazonSQS;
import com.amazonaws.services.sqs.model.CreateQueueRequest;
import com.amazonaws.services.sqs.model.CreateQueueResult;
import com.amazonaws.services.sqs.model.DeleteMessageBatchRequest;
import com.amazonaws.services.sqs.model.DeleteMessageBatchRequestEntry;
import com.amazonaws.services.sqs.model.DeleteMessageRequest;
import com.amazonaws.services.sqs.model.GetQueueUrlRequest;
import com.amazonaws.services.sqs.model.GetQueueUrlResult;
import com.amazonaws.services.sqs.model.Message;
import com.amazonaws.services.sqs.model.ReceiveMessageRequest;
import com.amazonaws.services.sqs.model.SendMessageRequest;

import boundless.log.QueueLog;
import boundless.types.Tuple;
import boundless.types.mq.MsgQueue;
import boundless.utility.CalculatePool;

public class SQSQueue implements MsgQueue {
	private AmazonSQS sqs;
	private String queueName;
	private String queueUrl;
	
	private SQSQueueFactory owner;

	private Set<Tuple<Consumer<String>, Consumer<Exception>>> handlers = new HashSet<Tuple<Consumer<String>, Consumer<Exception>>>();

	public SQSQueue(SQSQueueFactory factory, AmazonSQS sqs, String queueName){
		this.sqs = sqs;
		this.queueName = queueName;
		this.owner = factory;
		try{
			GetQueueUrlRequest req = new GetQueueUrlRequest(queueName);
			GetQueueUrlResult res = this.sqs.getQueueUrl(req);
			this.queueUrl = res.getQueueUrl();
		}catch(Exception e){
			QueueLog.error(log, e, String.format(" getQueueUrl exception for queue:%s ", queueName));
			try{
				CreateQueueRequest req = new CreateQueueRequest(queueName);
				CreateQueueResult res = this.sqs.createQueue(req);
				this.queueUrl = res.getQueueUrl();
			}catch(Exception er){
				QueueLog.error(log, er, String.format(" createQueue exception for queue:%s ", queueName));
				throw new RuntimeException(er);
			}
		}
		QueueLog.info(log, "queueUrl: {}", this.queueUrl);
	}
	
	boolean checkMsgOnce(){
		boolean flag = true;
		try{
			if(this.handlers.isEmpty()){
				return false;
			}
			for(Tuple<Consumer<String>, Consumer<Exception>> tuple : handlers){
				boolean tmp = dequeue(tuple.item1(), tuple.item2());
				if(tmp == false){
					flag = false;
				}
			}
		}catch(Exception e){
			QueueLog.error(log, e);
		}
		return flag;
	}
	
	void clearHandlers(){
		this.handlers.clear();
	}
	
	@Override
	public void close() {
		this.owner.deleteLocalQueue(this.queueName);
	}

	@Override
	public void enqueue(String msg) {
		SendMessageRequest req = new SendMessageRequest(this.queueUrl, msg);
		this.sqs.sendMessage(req);
	}

	@Override
	public boolean dequeue(Consumer<String> handler, Consumer<Exception> exhandler) {
		try{
			List<Message> messages = this.sqs.receiveMessage(this.queueUrl).getMessages();
			if(handler == null){
				return false;
			}
			List<DeleteMessageBatchRequestEntry> entrylist = new LinkedList<DeleteMessageBatchRequestEntry>();
			for(Message msg : messages){
				String body = msg.getBody();
				try{
					handler.accept(body);
				}catch(Exception e){
					if(exhandler != null){
						exhandler.accept(e);
					}
				}
				String messageReceiptHandle = msg.getReceiptHandle();
				DeleteMessageBatchRequestEntry entry = new DeleteMessageBatchRequestEntry(msg.getMessageId(), messageReceiptHandle);
				entrylist.add(entry);
			}
			CalculatePool.queueUserWorkItem(()->{
				DeleteMessageBatchRequest req = new DeleteMessageBatchRequest(this.queueUrl, entrylist);
				this.sqs.deleteMessageBatch(req);
			});
			return true;
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			if(exhandler != null){
				exhandler.accept(e);
			}
		}
		return false;
	}

	@Override
	public void publish(String msg) {
		enqueue(msg);
	}

	@Override
	public void subscribe(Consumer<String> handler, Consumer<Exception> exhandler) {
		Tuple<Consumer<String>, Consumer<Exception>> tuple = new Tuple<Consumer<String>, Consumer<Exception>>(handler, exhandler);
		this.handlers.add(tuple);
	}

	@Override
	public void delMsg(Object obj) {
		try{
			List<Message> messages = this.sqs.receiveMessage(this.queueUrl).getMessages();
			if(messages.isEmpty()) {
				return;
			}
			String messageReceiptHandle = messages.get(0).getReceiptHandle();
			DeleteMessageRequest delreq = new DeleteMessageRequest(messages.get(0).getMessageId(), messageReceiptHandle);
			this.sqs.deleteMessage(delreq);
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}

	@Override
	public void sendMsg(Object obj) {
		publish(obj.toString());
	}

	@Override
	public Object recvMsg(Object obj) {
		try{
			List<Message> messages = this.sqs.receiveMessage(this.queueUrl).getMessages();
			List<String> list = new ArrayList<String>(messages.size());
			List<DeleteMessageBatchRequestEntry> entrylist = new LinkedList<DeleteMessageBatchRequestEntry>();
			for(Message msg : messages){
				list.add(msg.getBody());
				String messageReceiptHandle = msg.getReceiptHandle();
				DeleteMessageBatchRequestEntry entry = new DeleteMessageBatchRequestEntry(msg.getMessageId(), messageReceiptHandle);
				entrylist.add(entry);
			}
			CalculatePool.queueUserWorkItem(()->{
				DeleteMessageBatchRequest req = new DeleteMessageBatchRequest(this.queueUrl, entrylist);
				this.sqs.deleteMessageBatch(req);
			});
			return list;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
		
	}

}
