package boundless.types;

/**
 * 对象自JSON化接口
 * @author zjf
 *
 */
public interface Jsonable {
	/**
	 * 转化为标准json对象，Map或者List
	 * @return
	 */
	public Object toMapOrList();
	
	/**
	 * 从Map或者List中初始化对象
	 * @param jsonobj
	 * 
	 */
	public void fromMapOrList(Object jsonobj);
	
}
