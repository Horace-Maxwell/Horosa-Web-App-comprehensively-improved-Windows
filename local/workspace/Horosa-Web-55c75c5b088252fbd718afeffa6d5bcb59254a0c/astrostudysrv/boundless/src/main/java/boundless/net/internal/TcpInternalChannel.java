package boundless.net.internal;

import io.netty.channel.Channel;

import java.util.*;

import boundless.function.Consumer0;
import boundless.net.*;
import boundless.net.external.*;

/**
 * 内部客户端网络通路
 *
 */
public class TcpInternalChannel extends TcpChannel<InternalPacketReader>
{
    private static HashMap<Integer, InternalPacketWriterSerializer> _serializers = new HashMap<Integer, InternalPacketWriterSerializer>();

    /**
     * 注册可输出数据的序列化器
     * @param dataTypeId 数据类型代码
     * @param serializer 序列化器
     */
    public static void registerSerializer(int dataTypeId, InternalPacketWriterSerializer serializer)
    {
        _serializers.put(dataTypeId,serializer);
    }

    private static InternalPacketWriterSerializer getSerializer(int dataTypeId)
    {
        return _serializers.get(dataTypeId);
    }

    private ITcpInternalContext _context;
    private IPacketSender _superPacketSender;
    private TcpInternalRemote _remote;
    private IOutputFilter _outputFilter;
    private IInternalPacketSender _internalPacketSender=(receiver, ipw)->{sendInternalPacketWriter(receiver, ipw);};

    TcpInternalChannel(int connectionId, Channel channel, ITcpInternalContext context)
    {
    	super(connectionId,channel,context);
        this._context = context;
    }

    @Override
    protected IPacketSender createPacketSender()
    {
        _superPacketSender = super.createPacketSender();
        return new PacketSender();
    }

    /**
     * 获得所在的远程机器
     * @return
     */
    public TcpInternalRemote remote()
    {
        return _remote;
    }
    void remote(TcpInternalRemote value){
    	_remote=value;
    }

    public void sendAsync(int connectionId, IPacketWriter pw)
    {
        sendPacketWriter(null, connectionId, pw);
    }

    /**
     * 发送数据
     * @param receiver
     * @param connectionId
     * @param pw
     */
    private void sendPacketWriter(IDataReceiver receiver, int connectionId, IPacketWriter pw)
    {
        boolean internalPacket=pw instanceof InternalPacketWriter;
        InternalPacketWriter ipw = internalPacket ? (InternalPacketWriter)pw : new InternalPacketWriter(connectionId, pw);
        if (ipw == null) return;
        if (!internalPacket)
        {
            ipw.packetId(InternalPacketIds.COMMUNICATION_CARRIER);
        }

        sendInternalPacketWriter(receiver, ipw);
    }

    /**
     * 带回调的发送方法
     * @param ipw
     * @param callback
     * @param timeoutCallback
     */
    public void sendAsync(InternalPacketWriter ipw, PacketHandler<InternalPacketReader, TcpInternalChannel, InternalPacketEventArgs> callback, Consumer0 timeoutCallback)
    {
        _context.sendAsync(null, ipw, _internalPacketSender, callback, timeoutCallback);
    }

    private void sendInternalPacketWriter(IDataReceiver receiver, InternalPacketWriter ipw)
    {
        if (filter(receiver,ipw)) return;

        if (receiver != null) ipw.connectionId(receiver.connectionId());

        _superPacketSender.sendAsync(receiver,ipw);
    }

    private boolean filter(IDataReceiver receiver, InternalPacketWriter ipw)
    {
        try
        {
            if (_outputFilter != null) return _outputFilter.filter(receiver, ipw);
            return false;
        }
        catch (Throwable ex)
        {
        	ex.printStackTrace();
            return true;
        }
    }

    /**
     * 获得输出数据过滤器对象
     * @return
     */
    public IOutputFilter outputFilter()
    {
        return _outputFilter;
    }
    /**
     * 设置输出数据过滤器对象
     * @param value
     */
    public void outputFilter(IOutputFilter value)
    {
        _outputFilter=value;
    }

    private static InternalPacketWriter[] serialize(IDataReceiver receiver, IOutputData output)
    {
        if (output instanceof InternalPacketWriter) return new InternalPacketWriter[] { (InternalPacketWriter)output  };
        else if (output instanceof IPacketWriter) return new InternalPacketWriter[] { new InternalPacketWriter(output.connectionId(), (IPacketWriter)output) };
        InternalPacketWriterSerializer serializer = getSerializer(output.dataTypeId());
        if (serializer == null) return null;
        return serializer.serialize(receiver, output);
    }
    
    private class PacketSender implements IPacketSender
    {
        public void sendAsync(IPacketReader reader)
        {
            sendAsync(null,new InternalPacketWriter(0,reader));
        }

        public void output(IDataReceiver receiver, IOutputData output)
        {
            InternalPacketWriter[] ipws = serialize(receiver, output);
            if (ipws == null || ipws.length == 0) return;
            for (InternalPacketWriter item : ipws)
            {
                sendAsync(receiver, item);
            }
        }

        public void sendAsync(IDataReceiver receiver, IPacketWriter pw)
        {
            sendPacketWriter(receiver, receiver != null ? receiver.connectionId() : 0, pw);
        }
        
        public void clearBuffer(){
        	if (_superPacketSender!=null) _superPacketSender.clearBuffer();
        }
        
        public void bufferPolicy(ISendBufferPolicy value){
        	_superPacketSender.bufferPolicy(value);
        }
    }
}
