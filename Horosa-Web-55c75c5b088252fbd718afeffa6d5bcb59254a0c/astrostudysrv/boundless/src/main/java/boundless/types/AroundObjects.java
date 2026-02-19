package boundless.types;

import java.util.ArrayList;
import java.util.List;

/**
 * 表示对象的周围八个方向的对象
 * @author zjf
 *
 */
public class AroundObjects {

	/**
	 * 获得或设置周围八个方向的单元格<br />
	 * 第0元素:左上，第1元素:上，第2元素:右上，第3元素:左，第4元素:右，第5元素:左下，第6元素:下，第7元素:右下
	 */
	private Object[] _around = new Object[8];
	
	public AroundObjects() {
	}

	public Object[] getAround(){
		return _around;
	}
	
	public void setAround(Object[] objs){
		System.arraycopy(objs, 0, _around, 0, 8);
	}
	
	public Object leftTop(){
		return _around[0];
	}
	
	public Object top() {
		return _around[1];
	}
	
	public Object rightTop() {
		return _around[2];
	}
	
	public Object left(){
		return _around[3];
	}
	
	public Object right(){
		return _around[4];
	}
	
	public Object leftBottom() {
		return  _around[5];
	}
	
	public Object bottom() {
		return _around[6];
	}
	
	public Object rightBottom() {
		return _around[7];
	}
	
}
