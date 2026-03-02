package boundless.model;

import java.util.ArrayList;
import java.util.Date;

import org.dom4j.Element;

import boundless.utility.FormatUtility;

public class ModelData extends HierarchicalMap {
	private static final long serialVersionUID = 7291061571656029949L;
	
	public static final int UNCHANGED = 0;
	public static final int ADDED = 1;
	public static final int DELETED = 2;
	public static final int MODIFIED = 3;
	public static final int UNKNOWED = 4;

	public ModelData()
	{
		this.setName(this.getClass().getName());
	}

	public int getState()
	{
		return getAttributeAsInt("state");
	}
	
	public void setState(int value){
		this.setAttribute("state",value);
	}

	/**
	 * 设置状态
	 * @param state
	 * @param includeDescendants 是否连同子孙一起设置成此状态
	 */
    public void setState(int state, boolean includeDescendants)
    {
        this.setState(state);
        if (!includeDescendants) return;
        for (ModelList item : this.getChildrenList())
        {
        	item.setState(state);
        }
    }

    /**
     * 设置在更新子记录之前，是否子记录先删除
     * @param state
     * @param includeDescendants 是否连同子孙子记录一起设置成此状态
     */
    public void setChildrenDeletedBefore(boolean state, boolean includeDescendants)
    {
        for(ModelList item : this.getChildrenList())
        {
            item.setDeletedBefore(state);
            if (!includeDescendants) continue;
            item.setChildrenDeletedBefore(state, true);
        }
    }

	public String getValueAsString(String fieldName)
	{
		HierarchicalMap node = this.getNode(fieldName);
		if (node == null) return "";
		return node.getValueAsString();
	}

	public int getValueAsInt(String fieldName)
	{
		HierarchicalMap node = this.getNode(fieldName);
		if (node == null) return 0;
		return node.getValueAsInt();
	}

    public long getValueAsLong(String fieldName)
    {
        HierarchicalMap node = this.getNode(fieldName);
        if (node == null) return 0;
        return node.getValueAsLong();
    }

	public double getValueAsDouble(String fieldName)
	{
		HierarchicalMap node = this.getNode(fieldName);
		if (node == null) return 0;
        return node.getValueAsDouble();
	}

	public Date getValueAsDateTime(String fieldName)
	{
		HierarchicalMap node = this.getNode(fieldName);
		if (node == null) return null;
		String dateTimeString = node.getValueAsString();
		Date resultDateTime;
		try
		{
            resultDateTime = FormatUtility.parseDateTime(dateTimeString, "YYYYMMDDHHMMSS");
		}
		catch(Exception e)
		{
			resultDateTime = FormatUtility.errorDate();
		}
		return resultDateTime;
	}

	public String getValueAsString(String fieldName, boolean original)
	{
		if (!original) return getValueAsString(fieldName);
		HierarchicalMap node = this.getNode(fieldName);
		if (node == null) return "";
		Attribute attr=node.getAttribute("oldValue");
		if (attr==null) return getValueAsString(fieldName);
		return attr.getValueAsString();
	}

	public void putOriginalValue(String fieldName, Object value)
	{
		HierarchicalMap node = this.getNode(fieldName);
		if (node==null)
		{
			node=this.newNode(fieldName);
			this.addNode(node);
		}
		node.setAttribute("oldValue",value);
	}

	public String getNodeValueAsString(String nodeName)
	{
		return getValueAsString(nodeName);
	}

	public int getNodeValueAsInt(String nodeName)
	{
		return getValueAsInt(nodeName);
	}

	public Date getNodeValueAsDateTime(String nodeName)
	{
		return getValueAsDateTime(nodeName);
	}

	public ModelList getChildren(Class childType)
	{
		return getChildren(childType,false);
	}

	public ModelList getChildren(Class childType,boolean create)
	{
		return getChildren(childType.getName(), create);
	}

	public ModelList getChildren(String childName)
	{
		return getChildren(childName, false);
	}

	public ModelList getChildren(String childName, boolean create)
	{
		HierarchicalMap node = this.getNode(childName);
		if (node!=null && !(node instanceof ModelList))
		{
			throw new RuntimeException("The Name has been used,Child Name:"+childName);
		}
		ModelList result = (ModelList)node;
		if (result == null && create)
		{
            result = newChildren(childName);
			this.addNode(result);
		}
		return result;
	}

    public ModelList newChildren(String childName)
    {
        Class childrenType = getChildrenType(childName);
        if (childrenType != null)
        {
            ModelList result;
			try {
				result = (ModelList) childrenType.newInstance();
			} catch (InstantiationException | IllegalAccessException e) {
				throw new RuntimeException(e);
			}
            result.setName(childName);
            return result;
        }
        HierarchicalMap node = newNode(childName);
        if (node == null || !(node instanceof ModelList))
        {
            throw new RuntimeException("The Child has been not supported,Child Name:" + childName);
        }
        return (ModelList)node;
    }

    public Class getChildrenType(String name)
    {
        return null;
    }

	public ModelData[] getFieldList()
	{
		ArrayList<ModelData> result = new ArrayList<ModelData>();
		for (int i = 0; i < this.getNodesCount(); i++)
		{
			if (!(this.getNode(i) instanceof ModelList))
			{
				result.add((ModelData)this.getNode(i));
			}
		}
		ModelData[] resultList=new ModelData[result.size()];

		return result.toArray(resultList);
	}

	public ModelList[] getChildrenList()
	{
		ArrayList<ModelList> result = new ArrayList<ModelList>();
		for (int i = 0; i < this.getNodesCount(); i++)
		{
			if (this.getNode(i) instanceof ModelList)
			{
				result.add((ModelList)this.getNode(i));
			}
		}
		ModelList[] resultList=new ModelList[result.size()];
		return resultList;
	}

    protected HierarchicalMap createNode(Element child)
	{
        return this.createNode(child.getName());
	}

    public HierarchicalMap createNode(String name)
    {
        return new ModelData();
    }

    /**
     * 从节点名里获得类名,节点名的命名规则为:类名+'-'+参数
     * @param name
     * @return
     */
    public static String getClassNameFromName(String name)
    {
        int length = name.indexOf('-');
        if (length < 0) length = name.length();
        return name.substring(0, length);
    }

    /**
     * 从节点名里获得参数,节点名的命名规则为:类名+'-'+参数
     * @param name
     * @return
     */
    public static String getClassParameterFromName(String name)
    {
        int index = name.indexOf('-');
        if (index < 0 || index + 1 >= name.length()) return "";
        return name.substring(index+1);
    }

}
