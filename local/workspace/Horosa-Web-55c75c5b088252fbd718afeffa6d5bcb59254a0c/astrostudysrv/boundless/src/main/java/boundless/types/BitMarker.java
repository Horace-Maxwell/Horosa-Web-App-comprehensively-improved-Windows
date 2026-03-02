package boundless.types;

import java.util.ArrayList;
import java.util.List;

/**
 * 位标记器
 * @author zjf
 *
 */
public class BitMarker {

	private List<Integer> _markList = new ArrayList<Integer>();
	
	public BitMarker(int maxValue) {
		autoIncrease(maxValue);
	}

	/**
	 * 自动扩容
	 * @param maxIndex
	 */
	private void autoIncrease(int maxIndex){
		int len = maxIndex / 32 + 1;
		for(int i = _markList.size(); i < len; i++){
			_markList.add(0);
		}
	}
	
	/**
	 * 判断value值的标志位是否为1
	 * @param value
	 * @return
	 */
	public boolean isSigned(int value){
		int max = _markList.size() * 32;
		if(value >= max){
			return false;
		}else{
			int m = value / 32;
			int n = value % 32;
			int val = _markList.get(m);
			int flag = 1 << n;
			
			return (val & flag) == flag;
		}
	}
	
	/**
	 * 将value值的标志位置为1
	 * @param value
	 */
	public void sign(int value){
		int max = _markList.size() * 32;
		if(value >= max){
			autoIncrease(value);
		}
		int m = value / 32;
		int n = value % 32;
		int val = _markList.get(m);
		int flag = 1 << n;

		_markList.set(m, val | flag);
	}
	
	/**
	 * 将value值的标志位置为0
	 * @param value
	 */
	public void unSign(int value){
		int max = _markList.size() * 32;
		if(value >= max){
			return;
		}
		int m = value / 32;
		int n = value % 32;
		int val = _markList.get(m);
		int flag = 1 << n;
		flag = ~flag;

		_markList.set(m, val & flag);
		
	}
	
	
}
