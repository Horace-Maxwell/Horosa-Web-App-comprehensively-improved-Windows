package boundless.model;

import org.dom4j.Element;

/**
 * 描述HierarchicalMap对象的结构
 * @author zjf
 *
 */
public class SchemasDefinition extends HierarchicalMap {
	private static final long serialVersionUID = -7044443019195605989L;

	/**
	 * 是否包含有类名为@childClassName的子节点
	 * @param childName 子节点类名
	 * @return
	 */
    public boolean hasChild(String childName)
    {
        return getNode(childName) != null;
    }

    /// <summary>
    /// 是否包含有类型为@childType的子节点
    /// </summary>
    /// <param name="childType">子节点类型</param>
    /// <returns></returns>
    /**
     * 是否包含有类型为@childType的子节点
     * @param childType 子节点类型
     * @return
     */
    public boolean hasChild(Class childType)
    {
        return hasChild(childType.getName());
    }

    /**
     * 增加子节点
     * @param childName
     * @return 子节点类名
     */
    public SchemasDefinition addChild(String childName)
    {
        return (SchemasDefinition)putNode(childName, "");
    }

    /**
     * 增加子节点
     * @param childType 子节点类型
     * @return
     */
    public SchemasDefinition addChild(Class childType)
    {
        return addChild(childType.getName());
    }

    /// <summary>
    /// 获得子节点
    /// </summary>
    /// <returns>子节点列表</returns>
    /**
     * 获得子节点
     * @return 子节点列表
     */
    public SchemasDefinition[] getChildren()
    {
        SchemasDefinition[] result = new SchemasDefinition[this.getNodesCount()];
        for (int i = 0; i < this.getNodesCount(); i++)
        {
            result[i] = (SchemasDefinition)this.getNode(i);
        }
        return result;
    }

    /**
     * 根据childType获取子类HierarchicalMap对象的结构
     * @param childType
     * @return
     */
    public SchemasDefinition getChild(Class childType)
    {
        return getChild(childType.getName());
    }

    /**
     * 根据childName获取子类HierarchicalMap对象的结构
     * @param childName
     * @return
     */
    public SchemasDefinition getChild(String childName)
    {
        return (SchemasDefinition)getNode(childName);
    }

    /**
     * 根据name获取子类型
     * @param name
     * @return
     */
    public HierarchicalMap createNode(String name)
    {
        return new SchemasDefinition();
    }

    /**
     * 根据Xml element获取子类型
     * @param child
     * @return
     */
    protected HierarchicalMap createNode(Element child)
    {
        return new SchemasDefinition(); 
    }

    /**
     * 拷贝HierarchicalMap对象的结构
     * @return
     */
    public SchemasDefinition copy()
    {
        return (SchemasDefinition)HierarchicalMap.createFromXml(this.toXml(), ()->{ return new SchemasDefinition(); });
    }
	
}
