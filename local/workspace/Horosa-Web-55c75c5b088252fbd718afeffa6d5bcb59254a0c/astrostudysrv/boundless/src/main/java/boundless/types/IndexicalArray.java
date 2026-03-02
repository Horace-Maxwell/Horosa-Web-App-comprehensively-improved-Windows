/**
 * 
 */
package boundless.types;

/**
 * 索引的数组。线程不安全。
 * 用于快速查找最靠近某个索引的索引列表。
 * @author zjf
 *
 */
public class IndexicalArray {

	private Object[] _indexArray;
	private int _startIndex;
	private int _endIndex;
	
	public IndexicalArray(int startIndex, int endIndex) {
		_indexArray =  new Object[endIndex - startIndex + 1];
        _startIndex = startIndex;
        _endIndex = endIndex;		
	}
	
	/**
	 * 获得指定索引对应的数据
	 * @param index
	 * @return
	 */
	public Object get(int index){
		return _indexArray[index - _startIndex];
	}
	
	/**
	 * 设置指定索引对应的数据
	 * @param index
	 * @param value
	 */
	public void set(int index, Object value){
		_indexArray[index - _startIndex] = value;
	}
	
	/**
	 * 指定的索引是否存在数据
	 * @param index
	 * @return
	 */
	public boolean exist(int index){
		return get(index) != null;
	}

	/**
	 * 获得与指定索引最靠近的索引列表
	 * @param index
	 * @return 最靠近的索引列表。如果长度为0表示都没有找到，长度最大为2
	 */
    public int[] findNearest(int index)
    {
        if (exist(index)) return new int[] { index };
        int rightNearestIndex = -1;
        for (int i = index + 1; i < _endIndex; i++)
        {
            if (exist(i))
            {
                rightNearestIndex = i;
                break;
            }
        }

        int leftNearestIndex = -1;
        for (int i = index - 1; i >= _startIndex; i--)
        {
            if (exist(i))
            {
                leftNearestIndex = i;
                break;
            }
        }

        if (leftNearestIndex >= 0 && rightNearestIndex >= 0)
        {
            int leftLen = index - leftNearestIndex;
            int rightLen = rightNearestIndex - index;
            if (leftLen == rightLen) return new int[] { leftNearestIndex, rightNearestIndex };
            else if (leftLen > rightLen) return new int[] { rightNearestIndex };
            else return new int[] { leftNearestIndex };
        }
        else if (leftNearestIndex >= 0)
        {
            return new int[] { leftNearestIndex };
        }
        else if (rightNearestIndex >= 0)
        {
            return new int[] { rightNearestIndex };
        }

        return new int[] { };
    }
	
}
