package boundless.utility;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

/**
 * 随机数实用类，以静态方法提供随机数常用的功能
 * @author zjf
 *
 */
public class RandomUtility {
	private static long deltaseed = 1;

	private static long holdrand = System.nanoTime();
	
	public static void setSeed(long seed) {
		holdrand = seed;
	}

    public static int random()
    {
        return (int)(((holdrand = holdrand * 214013L + 2531011L) >> 16) & 0x7fffffff);
    }

    public static int randomUInt()
    {
        return (int)(((holdrand = holdrand * 214013L + 2531011L) >> 16) & 0x7fffffff);
    }

    public static boolean chance()
    {
        return chance(randomFloat());
    }

    public static boolean chance(double chance)
    {
        return chance > 1 ? true : chance < 0 ? false : random() / (double)0x7fffffff <= chance;
    }

    public static boolean chance(float chance)
    {
        return chance > 1 ? true : chance < 0 ? false : randomFloat() <= chance;
    }

//    public static boolean chance(int chance)
//    {
//    	Random rand = new Random(holdrand);
//        return chance >= 10000 ? true : rand.nextInt(10000) <= chance;
//    }
    
    public static float randomFloat()
    {
        return (((holdrand = holdrand * 214013L + 2531011L) >> 16) & 0x7fffffff) / (float)0x7fffffff;
    }

    /**
     * Generates a pseudo-random number in range [from, to)
     * @param from
     * @param to
     * @return
     */
    public static int random(int from, int to)
    {
        return from == to ? from :
            (from > to
            ? ((random() % (from - to)) + to)
            : ((random() % (to - from)) + from));
    }

    public static short random(short from, short to)
    {
        return (short)random((int)from, (int)to);
    }

    public static int randomUInt(int from, int to)
    {
        return from == to ? from :
            (from > to ?
            ((randomUInt() % (from - to)) + to)
            : ((randomUInt() % (to - from)) + from));
    }

    public static int random(int max){
        return max == 0 ? 0 : random() % max;
    }

    public static int randomUInt(int max){
        return max == 0 ? 0 : randomUInt() % max;
    }

    public static float random(float from, float to)
    {
        return from > to ? randomFloat() * (from - to) + to : (randomFloat() * (to - from) + from);
    }

    public static double random(double from, double to)
    {
        return from > to ? randomFloat() * (from - to) + to : randomFloat() * (to - from) + from;
    }
  
    /**
     * 是否命中
     * @param probability 命中率。单位%
     * @return true:命中
     */
    public static boolean hit(int probability)
    {
        return hit(probability,new Random());
    }

    /**
     * 是否命中
     * @param probability 命中率。单位%
     * @param random 随机数
     * @return true:命中
     */
    public static boolean hit(int probability, Random random)
    {
        return random.nextInt(100) + 1 <= probability;
    }

    /**
     * 随机分配点数。采用随机值权重算法重新产生各属性的最大值。
     * @param totalPoint 总点数
     * @param count 分配个数
     * @param rand 
     * @return 每个分配到的点数，长度等于count
     */
    public static int[] RandomDistributePoint(int totalPoint, int count, Random rand)
    {
        int balanceVal = totalPoint;

        int[] rndAddtions = new int[count];

        int rvStartIndex = rand.nextInt(rndAddtions.length);

        for (int i = rvStartIndex + 1; balanceVal > 0 && i < rndAddtions.length; i++)
        {
            int rv = rand.nextInt(balanceVal + 1);
            rndAddtions[i] = rv;
            balanceVal -= rv;
        }

        for (int i = 0; balanceVal > 0 && i < rvStartIndex; i++)
        {
            int rv = rand.nextInt(balanceVal + 1);
            rndAddtions[i] = rv;
            balanceVal -= rv;
        }

        rndAddtions[rvStartIndex] = balanceVal;

        return rndAddtions;
    }
    
    /**
     * 返回随机字符串
     * @param count 字符串长度
     * @return
     */
    public static String randomString(int count){
        StringBuilder sb = new StringBuilder(count);
        Random rand = new Random(System.nanoTime());
        for (int i = 0; i < count; i++){
        	int n = rand.nextInt();
        	deltaseed = (deltaseed * 0x10001 >>> 16) * n;
        	rand.setSeed(deltaseed);
        	n = rand.nextInt();
        	n = Math.abs(n);
        	sb.append(Integer.toString(n, 36));
        }
        String res = sb.toString();
        return res.substring(0, count);
    	
    }
    
    public static String randomClearString(int count){
        StringBuilder sb = new StringBuilder(count);
        Random rand = new Random(System.nanoTime());
        for (int i = 0; i < count; i++){
        	int n = rand.nextInt();
        	deltaseed = (deltaseed * 0x10001 >>> 16) * n;
        	rand.setSeed(deltaseed);
        	n = rand.nextInt();
        	n = Math.abs(n);
        	String c = Integer.toString(n % 36, 36);
        	if(c.equals("o")){
        		c = "p";
        	}else if(c.equals("l")){
        		c = "n";
        	}else if(c.equals("I")){
        		c = "J";
        	}else if(c.equals("0")){
        		c = "2";
        	}else if(c.equals("1")){
        		c = "3";
        	}
        	sb.append(c);
        }
        String res = sb.toString();
        return res.substring(0, count);
    	
    }
    
    public static String randomStringDec(int count){
        StringBuilder sb = new StringBuilder(count);
        Random rand = new Random(System.nanoTime());
        for (int i = 0; i < count; i++){
        	int n = rand.nextInt();
        	deltaseed = (deltaseed * 0x10001 >>> 16) * n;
        	rand.setSeed(deltaseed);
        	n = rand.nextInt();
        	n = Math.abs(n);
        	sb.append(Integer.toString(n % 36, 10));
        }
        String res = sb.toString();
        return res.substring(0, count);
    	
    }
   
    public static long[] randomElement(long[] ary, int count){
    	List<Long> list = new ArrayList<Long>(ary.length);
    	for(long n : ary){
    		list.add(n);
    	}
    	Collections.shuffle(list);
    	long[] res = new long[count];
    	for(int i=0; i<count && i<list.size(); i++){
    		res[i] = list.get(i);
    	}
    	return res;
    }
    
    public static double randomDouble(long max, Random rand){
    	long n = (rand.nextLong() & 0x7fffffffffffffffl) % max;
    	long dec = (rand.nextLong() & 0x7fffffffffffffffl) % max;
    	String str = String.format("%d.%d", n, dec);
    	BigDecimal decimal = new BigDecimal(str);
    	return decimal.doubleValue();
    }
    
    public static long randomLong(long max, Random rand){
    	long n = rand.nextLong() % max;
    	return n;
    }
    
    public static long randomLong(long from, long to, Random rand){
    	long n = rand.nextLong() & 0x7fffffffffffffffl;
		return from == to ? from :
            (from > to ? ((n % (from - to)) + to) : ((n % (to - from)) + from));
    }
    
    public static double randomDouble(long from, long to, Random rand){
    	long n = rand.nextLong() & 0x7fffffffffffffffl;
    	n = from == to ? from :
            (from > to ? ((n % (from - to)) + to) : ((n % (to - from)) + from));
    	long dec = (rand.nextLong() & 0x7fffffffffffffffl) % to;
    	String str = String.format("%d.%d", n, dec);
    	BigDecimal decimal = new BigDecimal(str);
    	return decimal.doubleValue();
    }
    
    public static double randomDouble(long from, long to, Random rand, int precision){
    	long n = rand.nextLong() & 0x7fffffffffffffffl;
    	n = from == to ? from :
            (from > to ? ((n % (from - to)) + to) : ((n % (to - from)) + from));
    	long dec = (rand.nextLong() & 0x7fffffffffffffffl) % to;
    	String prec = dec + "";
    	if(prec.length() > precision) {
    		prec = prec.substring(0, precision);
    	}
    	String str = String.format("%d.%s", n, prec);
    	BigDecimal decimal = new BigDecimal(str);
    	return decimal.doubleValue();
    }
    
    public static void main(String[] args){
    	Random rand = new Random(System.nanoTime());
    	double n = randomDouble(200, rand);
    	System.out.println(n);
    	String str = randomClearString(8);
    	System.out.println(str);
    }
    
    
    
}
