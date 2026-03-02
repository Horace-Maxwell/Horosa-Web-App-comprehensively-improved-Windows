package boundless.security;

import java.util.Map;
import java.util.Map.Entry;

public class XorUtility {

	
	/**
	 * 异或加密
	 * @param data 明文
	 * @param keys 异或密钥。{Key:异或密钥; Value:在加密过程中，每次与多少个字节异或，明文中高字节在低下标，末尾字节不够的话，认为高字节不够}
	 * @return 密文
	 */
    public static byte[] encrypt(byte[] data, Entry<Long, Integer>[] keys)
    {
        byte[] result=new byte[data.length];
        System.arraycopy(data, 0, result, 0, data.length);
        
        for(Entry<Long, Integer> item : keys)
        {
            byte[] keyBytes = toBytes(item.getKey());
            for (int i = 0; i < data.length; i = i + item.getValue())
            {
                xor(result, i, item.getValue(), keyBytes);
            }    
        }
        
        return result;
    }
	
    /**
     * 异或解密
     * @param data 密文
	 * @param keys 异或密钥。{Key:异或密钥; Value:在加密过程中，每次与多少个字节异或，明文中高字节在低下标，末尾字节不够的话，认为高字节不够}
     * @return 明文
     */
    public static byte[] Decrypt(byte[] data, Entry<Long, Integer>[] keys)
    {
        byte[] result = new byte[data.length];
        System.arraycopy(data, 0, result, 0, data.length);
        
        for (int k = keys.length-1; k >=0; k--)
        {
        	Entry<Long, Integer> item = keys[k];
            byte[] keyBytes = toBytes(item.getKey());
            for (int i = 0; i < data.length; i = i + item.getValue())
            {
                xor(result, i, item.getValue(), keyBytes);
            }
        }

        return result;
    }
	
	/**
	 * 
	 * @param data
	 * @param startIndex
	 * @param length
	 * @param key 高字节在低下标
	 */
    private static void xor(byte[] data, int startIndex, int length, byte[] key)
    {
        int endIndex = startIndex + length - 1;
        if (endIndex >= data.length) endIndex = data.length - 1;
        int keyIndex=key.length-1;
        int i = endIndex;
        for (; i >= startIndex && keyIndex>=0; i--, keyIndex--)
        {
            data[i] = (byte)(data[i] ^ key[keyIndex]);
        }
    }

    /**
     * 把long转为字节数组
     * @param key
     * @return 高字节在低下标
     */
    private static byte[] toBytes(long key)
    {
        byte[] bytes = new byte[8];
        bytes[0] = (byte)(key >> 56);
        bytes[1] = (byte)(key >> 48);
        bytes[2] = (byte)(key >> 40);
        bytes[3] = (byte)(key >> 32);
        bytes[4] = (byte)(key >> 24);
        bytes[5] = (byte)(key >> 16);
        bytes[6] = (byte)(key >> 8);
        bytes[7] = (byte)key;
        return bytes;
    }

}
