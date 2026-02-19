package boundless.utility;

import java.util.Random;

/**
 * 数学计算实用类，以静态方法提供数学计算常用的功能
 * @author zjf
 *
 */
public class MathUtility {

	/**
	 * 已知路程和速度，求时间(毫秒)
	 * @param s 路程（像素）
	 * @param v 速度（像素/秒）
	 * @return
	 */
    public static int calcTime(float s, float v)
    {
        return (int)(1000 * (s / v));
    }

    /**
     * 概率是否命中
     * @param probability 概率的百分值[0~100]
     * @return
     */
    public static boolean isProbabilityHit(byte probability)
    {
        //先做简单实现

        return new Random(System.currentTimeMillis()).nextInt(101) <= probability;

    }

    /**
     * 角度转弧度
     * @param angle 角度
     * @return
     */
    public static double transform2Radians(double angle)
    {
        return angle * Math.PI / 180;
    }

    /**
     * 弧度转角度
     * @param radians 弧度
     * @return
     */
    public static double transform2Angle(double radians)
    {
        return radians * 180 / Math.PI;
    }

    public static boolean isDoubleZero(double n) {
		final double delta = 0.00001;
		return n < delta;
    }
}
