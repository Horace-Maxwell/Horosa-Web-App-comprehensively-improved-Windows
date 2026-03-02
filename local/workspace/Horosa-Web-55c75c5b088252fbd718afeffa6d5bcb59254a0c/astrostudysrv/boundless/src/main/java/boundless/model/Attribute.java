package boundless.model;

import java.io.Serializable;

import boundless.utility.ConvertUtility;

public class Attribute implements Serializable {
	private static final long serialVersionUID = 437761209317931093L;
	
	private String key;
	private Object value;

	public Attribute()
	{
	
	}

	public Attribute(String key, Object value)
	{
		this.key = key;
		this.value = value;
	}

	/**
	 * 属性标识
	 * @return
	 */
	public String getKey()
	{
		return this.key;
	}
	
	public void setKey(String key){
		this.key = key;
	}

	/**
	 * 属性值
	 * @return
	 */
	public Object getValue()
	{
		return this.value;
	}
	
	public void setValue(Object value){
		this.value = value;
	}

	/**
	 * 获取字串类型的值
	 * @return
	 */
	public String getValueAsString()
	{
        return ConvertUtility.getValueAsString(getValue());
	}

	/**
	 * 获取Int类型的值
	 * @return
	 */
	public int getValueAsInt()
	{
        return ConvertUtility.getValueAsInt(getValue());
	}

	/**
	 * 获取double类型的值
	 * @return
	 */
	public double getValueAsDouble()
	{
        return ConvertUtility.getValueAsDouble(getValue());
	}

	/**
	 * 获取boolean类型的值
	 * @return
	 */
	public boolean getValueAsBool()
	{
        return ConvertUtility.getValueAsBool(getValue());
	}

}
