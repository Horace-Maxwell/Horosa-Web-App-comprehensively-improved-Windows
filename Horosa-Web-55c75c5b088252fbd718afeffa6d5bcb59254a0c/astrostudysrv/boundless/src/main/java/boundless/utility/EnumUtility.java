package boundless.utility;

import java.util.ArrayList;
import java.util.List;

/**
 * 枚举类型实用类
 * @author zjf
 *
 */
public class EnumUtility {

	/**
	 * 获得bit从低位到高位，最后一个为1的在bit上的位置
	 * @param power
	 * @return
	 */
    public static int lastIndexOfFlag(int power)
    {
        int tempValue = power;
        int result = 0;
        while (true)
        {
            if (tempValue == 0) break;
            result++;
            tempValue = tempValue >> 1;
        }
        return result;
    }

    /**
     * 获得bit从低位到高位，为1的在bit上的位置
     * @param power 幂
     * @return
     */
    public static int[] flags(int power)
    {
        List<Integer> indexs = new ArrayList<Integer>();

        int tempValue = power;
        for (int i = 0; i < 32; i++)
        {
            if ((tempValue & 1) == 1) indexs.add(i);
            tempValue = tempValue >> 1;
        }

        int[] res = new int[indexs.size()];
        for(int i=0; i<res.length; i++){
        	res[i] = indexs.get(i);
        }
        
        return res;
    }

}
