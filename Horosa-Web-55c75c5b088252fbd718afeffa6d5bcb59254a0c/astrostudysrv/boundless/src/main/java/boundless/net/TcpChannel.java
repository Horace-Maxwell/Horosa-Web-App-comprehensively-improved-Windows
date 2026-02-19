package boundless.net;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.function.*;
import java.net.*;

import io.netty.buffer.*;
import io.netty.channel.*;
import boundless.function.*;
import boundless.log.Logger;
import boundless.utility.StringUtility;

/**
 * TCP网络通路对象
 *
 * @param <T_PacketReader>
 */
public class TcpChannel<T_PacketReader extends IPacketReader>{
	 
	
	private static Map<Integer, Function<IOutputData,IPacketWriter[]>> _serializers = new HashMap<Integer, Function<IOutputData,IPacketWriter[]>>();

	/**
	 * 注册可输出数据的序列化器
	 * 
	 * @param dataTypeId
	 *            数据类型代码
	 * @param serializer
	 *            序列化器
	 */
	public static void registerSerializer(int dataTypeId,
			Function<IOutputData, IPacketWriter[]> serializer) {
		_serializers.put(Integer.valueOf(dataTypeId), serializer);
	}

	private static Function<IOutputData, IPacketWriter[]> getSerializer(
			int dataTypeId) {
		return _serializers.get(Integer.valueOf(dataTypeId));
	}
     
	//当关闭时触发
    private ConsumerDelegate<TcpChannel<T_PacketReader>> _closeDelegate=new ConsumerDelegate<TcpChannel<T_PacketReader>>();

    private Channel _channel;
    private IPacketSender _packetSender = null;
    private ITcpContext<T_PacketReader> _context;
    private LocalDateTime _createTime= LocalDateTime.now();
    private LocalDateTime _timeoutTime = LocalDateTime.now().plusMinutes(3);
    private boolean _closing=false;
    private int _connectionId;
    private SocketAddress _address;
    private String _description;
    private String _ip="";

    public TcpChannel(int connectionId, Channel channel, ITcpContext<T_PacketReader> context)
    {
        this._connectionId = connectionId;
        this._channel = channel;
        this._context=context;

        this._address = this._channel.remoteAddress();
        this._description = this._address + "(" + connectionId + ")";
        this._packetSender=createPacketSender();
        
        this.alive();
        
        if (this._address!=null){
           String[] strs=this._address.toString().split(":");
           this._ip=StringUtility.trim(strs[0],new char[]{'/','\\'});
        }
    }

    protected IPacketSender createPacketSender()
    {
        return new PacketSender();
    }

    public LocalDateTime createTime()
    {
        return _createTime;
    }

    public SocketAddress address()
    {
        return _address;
    }
    
    public String ip(){
    	return _ip;
    }

    public String description()
    {
        return this._description;
    }

    /**
     * 获得连接ID
     * @return
     */
    public int connectionId()
    {
        return _connectionId;
    }

    public Channel channel()
    {
        return _channel;
    }

    /**
     * 输出数据
     * @param output
     */
    public void output(IOutputData output)
    {
        this.output(null, output);
    }

    public void output(IDataReceiver receiver, IOutputData output)
    {
        _packetSender.output(receiver,output);
    }

    public void alive()
    {
        _timeoutTime = LocalDateTime.now().plusSeconds(this._context.timeoutSeconds());
    }

    public boolean isAlive()
    {
        return LocalDateTime.now().isBefore(_timeoutTime) && _channel.isActive();
    }

    public void open()
    {
    }
    
    /**
     * 异步发送数据。从IPacketWriter对象里获取输出数据，然后发送
     * @param writer
     */
    public void sendAsync(IPacketWriter writer)
    {
        this.sendAsync(null, writer);
    }

    /**
     * 发送数据
     * @param receiver 接收者
     * @param pw
     */
    public void sendAsync(IDataReceiver receiver, IPacketWriter pw)
    {
        if (_closing) return;
        _packetSender.sendAsync(receiver, pw);
    }

    /**
     * 异步发送数据。从IPacketReader对象里获取输入数据，然后发送
     * @param reader
     */
    public void sendAsync(IPacketReader reader)
    {
        if (_closing) return;
        _packetSender.sendAsync(reader);
    }

    /**
     * 新增连接关闭监听器
     * @param ls
     */
    public void addOnClose(Consumer<TcpChannel<T_PacketReader>> ls){
    	_closeDelegate.add(ls);
    }
    
    /**
     * 移除连接关闭监听器
     * @param ls
     */
    public void removeOnClose(Consumer<TcpChannel<T_PacketReader>> ls){
    	_closeDelegate.remove(ls);
    }

    public void close()
    {
    	synchronized (this)
        {
            if (this._closing) return;
            this._closing = true;
        }

    	try
        {
            _channel.close();
        }
        catch(Throwable ex) { }
    	
        try
        {
        	raiseOnClose();
        }
        catch (Exception ex)
        {
            _context.networkErrorLogger().writeLog(ex);
        }
        finally
        {
            _closeDelegate.clear();
        }
    }

    private void raiseOnClose(){
    	_closeDelegate.execute(this);
    }
    
    public void clearSendingBuffer(){
    	_packetSender.clearBuffer();
    }
    
    public void sendBufferPolicy(ISendBufferPolicy value){
    	_packetSender.bufferPolicy(value);
    }
    
    private class PacketSender implements IPacketSender
    {
    	private SendingBufferQueue _queue=new SendingBufferQueue();
    	private ChannelFutureListener _sendListener;
    	private boolean _sending = false;
    	
    	private long _sendTime = 0;
    	private long _enqueueTime = 0;
    	
    	private ISendBufferPolicy _policy=new ISendBufferPolicy() {
		};
    	
    	public PacketSender(){
    		_sendListener=(ChannelFuture f)->{
    			_sending = false;
    			if (f.isSuccess()){
    				long delta = (System.nanoTime() - _sendTime) / 1000;
    				if(Logger.isDebug && _context.logger() != null) _context.logger().writeLog("sendingDeltaTime: " + delta + " us");
    				
    				sendNext();
    			}
    			else {
    				_context.networkErrorLogger().writeLog("ChannelFuture error,client:" + description() + " isDone:" + f.isDone() + "; isCancelled:" + f.isCancelled(),f.cause());
    				close();
    			}
    		};
    	}
    	
        public void sendAsync(IDataReceiver receiver, IPacketWriter pw)
        {
        	byte[] data=pw.outputData();
        	
        	if (isOverflow(data)){
        		if (!_policy.onOverflow(pw)){
        			if (_context.logger() != null && _context.trackPacket())
                    {
                        _context.logger().writeLog("Send Packet overflow, Id:"+pw.packetId()+",size:"+data.length+",client:"+_description+",send time:"+DateTimeFormatUtility.currentTime());
                    }		
        			return;
        		}
        	} else {
        		if (!_policy.onEnqueue(pw)){
        			if (_context.logger() != null && _context.trackPacket())
                    {
                        _context.logger().writeLog("Send Packet ingore, Id:"+pw.packetId()+",size:"+data.length+",client:"+_description+",send time:"+DateTimeFormatUtility.currentTime());
                    }		
        			return;
        		}
        	}
        	
        	long delta = 0;
        	if(_enqueueTime > 0){
        		delta = (System.nanoTime() -_enqueueTime) / 1000;
        	}
        	_enqueueTime = System.nanoTime();
        	
        	enqueue(data);
            if (_context.logger() != null && _context.trackPacket())
            {
                _context.logger().writeLog("Send Packet, Id:"+pw.packetId()+",size:"+data.length+",client:"+_description+
                		",send time:"+DateTimeFormatUtility.currentTime() + ",DeltaTimeBetweenEnqueues:" + delta + " us");
            }
        }
        
        public void sendAsync(IPacketReader reader)
        {
        	byte[] data=reader.inputData();

        	if (isOverflow(data)){
        		if (!_policy.onOverflow(reader)){
        			if (_context.logger() != null && _context.trackPacket())
                    {
                        _context.logger().writeLog("Send Packet overflow, Id:"+reader.packetId()+",size:"+data.length+",client:"+_description+",send time:"+DateTimeFormatUtility.currentTime());
                    }		
        			return;
        		}
        	} else {
        		if (!_policy.onEnqueue(reader)){
        			if (_context.logger() != null && _context.trackPacket())
                    {
                        _context.logger().writeLog("Send Packet ingore, Id:"+reader.packetId()+",size:"+data.length+",client:"+_description+",send time:"+DateTimeFormatUtility.currentTime());
                    }		
        			return;
        		}
        	}
        	
        	long delta = 0;
        	if(_enqueueTime > 0){
        		delta = (System.nanoTime() -_enqueueTime) / 1000;
        	}
        	_enqueueTime = System.nanoTime();
        	
        	enqueue(data);
            if (_context.logger() != null && _context.trackPacket())
            {
                _context.logger().writeLog("Send Packet, Id:"+reader.packetId()+",size:"+data.length+",client:"+_description+
                		",send time:"+DateTimeFormatUtility.currentTime() + ",DeltaTimeBetweenEnqueues:" + delta + " us");
            }
        }

        private boolean isOverflow(byte[] data){
        	return _policy.maxCapacity()>0 && data.length+_queue.byteSize()>_policy.maxCapacity();
        }
        
        public void output(IDataReceiver receiver, IOutputData output)
        {
            IPacketWriter[] ipws = serialize(output);
            if (ipws == null || ipws.length == 0) return;
            for (IPacketWriter item : ipws)
            {
                sendAsync(null,item);
            }
        }

        private IPacketWriter[] serialize(IOutputData output)
        {
        	Function<IOutputData,IPacketWriter[]> serializer = getSerializer(output.dataTypeId());
            if (serializer == null) return null;
            return serializer.apply(output);
        }
        
        private void enqueue(byte[] data){
        	synchronized (_queue)
            {
        		_queue.enqueue(data);
            }

            if (!_sending) sendNext();
        }
        
        private void sendNext()
        {
            synchronized (_queue) {
                if (_sending) return;
                _sending = false;
                
                ByteBuf buf=_queue.dequeue();
                if (buf==null) return;
                _sending = true;

                try
                {
                	alive();
                	_channel.writeAndFlush(buf).addListener(_sendListener);
                    _sendTime = System.nanoTime();
                }
                catch (Throwable ex)
                {
                    _sending = false;
                    close();
                    _context.networkErrorLogger().writeLog("writeAndFlush error,client:" + description(), ex);
                }
            }
        }
        
        public int sendingSize()
        {
        	synchronized (_queue)
            {
                return _queue.byteSize();
            }
        }
        
        public void clearBuffer(){
        	synchronized (_queue) {
				_queue.clear();
			}
        }
        
        public void bufferPolicy(ISendBufferPolicy value){
        	_policy=value;
        }
    }
    
    private static class SendingBufferQueue{
    	private static final int TCP_MTU=1460;
    	
    	private int _byteSize; 
    	private LinkedList<SendingBuffer> _queue=new LinkedList<SendingBuffer>();
    	
    	public int byteSize(){
    		return _byteSize;
    	}
    	
    	public void enqueue(byte[] data){
    		SendingBuffer lastBuffer=_queue.peekLast();
    		if (lastBuffer==null || lastBuffer.size()>=TCP_MTU){
    			_queue.add(new SendingBuffer(data));
    			_byteSize+=data.length;
    			return;
    		}
    		
    		lastBuffer.add(data);
    		_byteSize+=data.length;
    	}
    	
    	public ByteBuf dequeue(){
    		SendingBuffer firstBuffer=_queue.poll();
    		if (firstBuffer==null) return null;
    		_byteSize-=firstBuffer.size();
    		return firstBuffer.byteBuf();
    	}
    	
    	public void clear(){
    		_queue.clear();
    		_byteSize=0;
    	}
    }
    
    private static class SendingBuffer{
    	private int _size;
    	private LinkedList<byte[]> _list=new LinkedList<>();
    	
    	public SendingBuffer(byte[] data){
    		add(data);
    	}
    	
    	public void add(byte[] data){
    		_list.add(data);
    		_size+=data.length;
    	}
    	
    	public int size(){
    		return _size;
    	}
    	
    	public ByteBuf byteBuf(){
    		 if (_list.size()==1) return Unpooled.wrappedBuffer(_list.get(0));
    		 
    		 byte[] data=new byte[_size];
    		 int index=0;
    		 for (byte[] item : _list) {
    			 System.arraycopy(item, 0, data, index,
    					 item.length);
    			 index+=item.length;
			}
    		 return Unpooled.wrappedBuffer(data);
    	}
    }
}
