package boundless.io;

import java.io.IOException;
import java.util.Map;

import com.baidu.bjf.remoting.protobuf.Codec;
import com.baidu.bjf.remoting.protobuf.FieldType;
import com.baidu.bjf.remoting.protobuf.ProtobufProxy;
import com.baidu.bjf.remoting.protobuf.annotation.Protobuf;

public class ProtoBufUtility {

	public static <T> byte[] encode(T obj, Class<T> class1) {
		Codec<T> codec = ProtobufProxy.create(class1);
		try {
			return codec.encode(obj);
		} catch (IOException e) {
			throw new RuntimeException(e);
		}
	}

	public static <T> T decode(byte[] datas, Class<T> class1) {
		Codec<T> codec = ProtobufProxy.create(class1);
		try {
			return codec.decode(datas);
		} catch (IOException e) {
			throw new RuntimeException(e);
		}
	}
	
	public static long decodeAsLong(byte[] data){
		Codec<PBLong> codec = ProtobufProxy.create(PBLong.class);
		try {
			PBLong num = codec.decode(data);
			return num.value;
		} catch (IOException e) {
			throw new RuntimeException(e);
		}
	}
	
	public static int decodeAsInt(byte[] data){
		Codec<PBInt> codec = ProtobufProxy.create(PBInt.class);
		try {
			PBInt num = codec.decode(data);
			return num.value;
		} catch (IOException e) {
			throw new RuntimeException(e);
		}
	}
	
	public static double decodeAsDouble(byte[] data){
		Codec<PBDouble> codec = ProtobufProxy.create(PBDouble.class);
		try {
			PBDouble num = codec.decode(data);
			return num.value;
		} catch (IOException e) {
			throw new RuntimeException(e);
		}
	}
	
	public static boolean decodeAsBool(byte[] data){
		Codec<PBBool> codec = ProtobufProxy.create(PBBool.class);
		try {
			PBBool num = codec.decode(data);
			return num.value;
		} catch (IOException e) {
			throw new RuntimeException(e);
		}
	}
	
	public static byte[] decodeAsBytes(byte[] data){
		Codec<PBBytes> codec = ProtobufProxy.create(PBBytes.class);
		try {
			PBBytes num = codec.decode(data);
			return num.value;
		} catch (IOException e) {
			throw new RuntimeException(e);
		}
	}
	
	public static float decodeAsFloat(byte[] data){
		Codec<PBFloat> codec = ProtobufProxy.create(PBFloat.class);
		try {
			PBFloat num = codec.decode(data);
			return num.value;
		} catch (IOException e) {
			throw new RuntimeException(e);
		}
	}
	
	public static String decodeAsString(byte[] data){
		Codec<PBString> codec = ProtobufProxy.create(PBString.class);
		try {
			PBString num = codec.decode(data);
			return num.value;
		} catch (IOException e) {
			throw new RuntimeException(e);
		}
	}
		
	public static Map decodeAsMap(byte[] data){
		Codec<PBMap> codec = ProtobufProxy.create(PBMap.class);
		try {
			PBMap num = codec.decode(data);
			return num.value;
		} catch (IOException e) {
			throw new RuntimeException(e);
		}
	}
	
	public static byte[] encode(long n){
		PBLong pb = new PBLong();
		pb.value = n;
		Codec<PBLong> codec = ProtobufProxy.create(PBLong.class);
		try {
			return codec.encode(pb);
		} catch (IOException e) {
			throw new RuntimeException(e);
		}
	}
	
	public static byte[] encode(boolean n){
		PBBool pb = new PBBool();
		pb.value = n;
		Codec<PBBool> codec = ProtobufProxy.create(PBBool.class);
		try {
			return codec.encode(pb);
		} catch (IOException e) {
			throw new RuntimeException(e);
		}
	}
	
	public static byte[] encode(byte[] n){
		PBBytes pb = new PBBytes();
		pb.value = n;
		Codec<PBBytes> codec = ProtobufProxy.create(PBBytes.class);
		try {
			return codec.encode(pb);
		} catch (IOException e) {
			throw new RuntimeException(e);
		}
	}
	
	public static byte[] encode(double n){
		PBDouble pb = new PBDouble();
		pb.value = n;
		Codec<PBDouble> codec = ProtobufProxy.create(PBDouble.class);
		try {
			return codec.encode(pb);
		} catch (IOException e) {
			throw new RuntimeException(e);
		}
	}
	
	public static byte[] encode(float n){
		PBFloat pb = new PBFloat();
		pb.value = n;
		Codec<PBFloat> codec = ProtobufProxy.create(PBFloat.class);
		try {
			return codec.encode(pb);
		} catch (IOException e) {
			throw new RuntimeException(e);
		}
	}
	
	public static byte[] encode(int n){
		PBInt pb = new PBInt();
		pb.value = n;
		Codec<PBInt> codec = ProtobufProxy.create(PBInt.class);
		try {
			return codec.encode(pb);
		} catch (IOException e) {
			throw new RuntimeException(e);
		}
	}
	
	public static byte[] encode(Map n){
		PBMap pb = new PBMap();
		pb.value = n;
		Codec<PBMap> codec = ProtobufProxy.create(PBMap.class);
		try {
			return codec.encode(pb);
		} catch (IOException e) {
			throw new RuntimeException(e);
		}
	}
	
	public static byte[] encode(String n){
		PBString pb = new PBString();
		pb.value = n;
		Codec<PBString> codec = ProtobufProxy.create(PBString.class);
		try {
			return codec.encode(pb);
		} catch (IOException e) {
			throw new RuntimeException(e);
		}
	}
		
	
	
	
	public static class PBLong{
		@Protobuf(fieldType = FieldType.INT64, order = 1, required = false)
		public long value;
	}
	
	public static class PBInt{
		@Protobuf(fieldType = FieldType.INT32, order = 1, required = false)
		public int value;
	}
	
	public static class PBBytes{
		@Protobuf(fieldType = FieldType.BYTES, order = 1, required = false)
		public byte[] value;
	}
	
	public static class PBBool{
		@Protobuf(fieldType = FieldType.BOOL, order = 1, required = false)
		public boolean value;
	}
	
	public static class PBDouble{
		@Protobuf(fieldType = FieldType.DOUBLE, order = 1, required = false)
		public double value;
	}
	
	public static class PBFloat{
		@Protobuf(fieldType = FieldType.FLOAT, order = 1, required = false)
		public float value;
	}
	
	public static class PBString{
		@Protobuf(fieldType = FieldType.STRING, order = 1, required = false)
		public String value;
	}
	
	public static class PBMap{
		@Protobuf(fieldType = FieldType.MAP, order = 1, required = false)
		public Map value;
	}
	
	
}
