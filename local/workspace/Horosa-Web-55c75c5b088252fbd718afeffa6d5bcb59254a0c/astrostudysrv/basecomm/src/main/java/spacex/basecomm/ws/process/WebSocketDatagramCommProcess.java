package spacex.basecomm.ws.process;


import java.util.HashMap;
import java.util.Map;

import boundless.exception.ErrorCodeException;
import boundless.netty.BasePacketIds;
import boundless.netty.Datagram;
import boundless.netty.PacketRegistor;
import boundless.netty.ProcessorContext;
import boundless.netty.WebSocketDatagram;
import boundless.utility.RandomUtility;
import boundless.utility.StringUtility;
import spacex.basecomm.ws.command.WebSocketCmd;
import spacex.basecomm.ws.packet.WebSocketPacketIds;

public class WebSocketDatagramCommProcess {

	public static void build(PacketRegistor registor) {
		registor.register(BasePacketIds.HeartBeat, (ctx)->heartbeat(ctx));
		registor.register(BasePacketIds.WebSockePacket, (ctx)->websocketPkg(ctx));
		registor.register(WebSocketPacketIds.WSErrorTest, (ctx)->errorTest(ctx));
		registor.register(WebSocketPacketIds.WSTimeTest, (ctx)->timeTest(ctx));
		registor.register(WebSocketPacketIds.JsonRequest, (ctx)->jsonRequest(ctx));
	}
	
	private static void heartbeat(ProcessorContext ctx) {
		WebSocketDatagram inData = (WebSocketDatagram) ctx.getInData();
		
		Datagram outData = WebSocketCmd.heartbeat();
		ctx.send(outData);
	}
	
	private static void jsonRequest(ProcessorContext ctx) {
		WebSocketDatagram inData = (WebSocketDatagram) ctx.getInData();
		
	}
	
	private static void websocketPkg(ProcessorContext ctx) {
		WebSocketDatagram inData = (WebSocketDatagram) ctx.getInData();
		int cmd = inData.command();
		String hexcmd = StringUtility.toHex(cmd);
		String msg = String.format("no handle for command: %d, hex: %s\nrx: %s", cmd, hexcmd, inData.getString());
		throw new ErrorCodeException(999999, msg);
	}
	
	private static void errorTest(ProcessorContext ctx) {
		WebSocketDatagram inData = (WebSocketDatagram) ctx.getInData();
		int code = RandomUtility.random();
		throw new ErrorCodeException(code, "服务器抛出异常");
	}
	
	private static void timeTest(ProcessorContext ctx) {
		WebSocketDatagram inData = (WebSocketDatagram) ctx.getInData();
		
		Map<String, Object> res = new HashMap<String, Object>();
		res.put("Time", System.currentTimeMillis());
		Datagram outData = WebSocketCmd.genDatagram(inData.command(), res);
		ctx.send(outData);
	}
	
	
}
