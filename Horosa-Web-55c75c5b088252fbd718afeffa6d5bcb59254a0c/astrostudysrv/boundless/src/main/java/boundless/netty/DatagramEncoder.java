package boundless.netty;


import boundless.security.RSASetup;
import io.netty.buffer.ByteBuf;
import io.netty.channel.ChannelHandlerContext;
import io.netty.handler.codec.MessageToByteEncoder;

public class DatagramEncoder extends MessageToByteEncoder<Datagram> implements RSASetup{
	private String publicExp;
	private String modulus;
	private boolean useRSA;
	
	public DatagramEncoder(){
		
	}
	
	public void setPublicKey(String pubicModulus, String pubicExp){
		this.publicExp = pubicExp;
		this.modulus = pubicModulus;
	}

	public void setUseRSA(boolean value){
		this.useRSA = value;
	}

	@Override
	protected void encode(ChannelHandlerContext ctx, Datagram datagram, ByteBuf buf) throws Exception {
		byte[] data;
		if(this.useRSA){
			data = datagram.encodeRSA(this.modulus, this.publicExp);
		}else{
			data = datagram.getAllRawData();
		}
		buf.writeBytes(data);
	}

}
