package boundless.netty;

import java.net.InetSocketAddress;
import java.util.List;

import boundless.security.RSASetup;
import io.netty.buffer.ByteBuf;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.socket.DatagramPacket;
import io.netty.handler.codec.MessageToMessageEncoder;

public class DatagramPacketEncoder extends MessageToMessageEncoder<Datagram> implements RSASetup{
	private String publicExp;
	private String modulus;
	private boolean useRSA;
	
	private final InetSocketAddress remoteAddress;  
	
	public DatagramPacketEncoder(InetSocketAddress remoteAddress){
		this.remoteAddress = remoteAddress;
	}
	
	public void setPublicKey(String pubicModulus, String pubicExp){
		this.publicExp = pubicExp;
		this.modulus = pubicModulus;
	}

	public void setUseRSA(boolean value){
		this.useRSA = value;
	}


	@Override
	protected void encode(ChannelHandlerContext ctx, Datagram msg, List<Object> out) throws Exception {
		ByteBuf buf = ctx.alloc().buffer();
		byte[] data;
		if(this.useRSA){
			data = msg.encodeRSA(this.modulus, this.publicExp);
		}else{
			data = msg.getAllRawData();
		}
		buf.writeBytes(data);
		out.add(new DatagramPacket(buf, remoteAddress));
	}

}
