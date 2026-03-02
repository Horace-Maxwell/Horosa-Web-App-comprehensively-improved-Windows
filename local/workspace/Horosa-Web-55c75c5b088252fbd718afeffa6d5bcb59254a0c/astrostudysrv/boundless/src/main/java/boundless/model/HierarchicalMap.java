package boundless.model;

import java.io.File;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.function.Supplier;

import org.dom4j.Document;
import org.dom4j.DocumentException;
import org.dom4j.DocumentHelper;
import org.dom4j.Element;
import org.dom4j.Node;
import org.dom4j.io.SAXReader;

import boundless.console.ApplicationUtility;
import boundless.io.FileUtility;
import boundless.security.SecurityUtility;
import boundless.utility.ConvertUtility;
import boundless.utility.FormatUtility;
import boundless.utility.IPUtility;
import boundless.utility.StringUtility;

public class HierarchicalMap extends TreeNode {
	private static final long serialVersionUID = 4829590888709492887L;

	private Object value;
    private Map<String, Attribute> _attributes = new HashMap<String, Attribute>();
	private String _name;

	public HierarchicalMap()
	{
	}

	public HierarchicalMap(String name) 
	{
		setName(name);
	}

	public HierarchicalMap(String name, Object value)
	{
		this(name);
		setValue(value);
	}
	
	public void addNode(HierarchicalMap node){
		super.addNode(node);
		this.setCaption(node.getName());
		this.setText(node.getValueAsString());
	}
	
	public void addNode(int index, HierarchicalMap node){
		super.addNode(index, node);
		this.setCaption(node.getName());
		this.setText(node.getValueAsString());
	}
	
	public HierarchicalMap[] getSubNodes(){
		HierarchicalMap[] res = new HierarchicalMap[this.getNodesCount()];
		int i = 0;
		for(TreeNode node : super.getNodes()){
			res[i++] = (HierarchicalMap) node;
		}
		
		return res;
	}


	/**
	 * 取得节点值
	 * @return
	 */
	public Object getValue() 
	{
		return this.value;
	}

	/**
	 * 取得节点名称
	 * @return
	 */
	public String getName()
	{
		return this._name;
	}
	
	public void setName(String name){
		this._name = name;
	}

	/**
	 * 取得节点所有属性
	 * @return Attribute数组,每个Attribute保存一个键值
	 */
	public Attribute[] getAttributes()
	{
		Attribute[] res = new Attribute[_attributes.size()];
		
        return _attributes.values().toArray(res);
	}

	/**
	 * 根据属性key取得节点属性
	 * @param key 键值
	 * @return
	 */
	public Attribute getAttribute(String key)
	{
        return _attributes.get(key);
	}

    public boolean removeAttribute(String key)
    {
        return _attributes.remove(key) != null;
    }

    /**
     * 根据属性key获得属性值
     * @param key
     * @return
     */
	public String getAttributeAsString(String key)
	{
		Attribute attr = getAttribute(key);
		if (attr == null)
			return "";
		String res = attr.getValueAsString();
		return res;
	}

	/**
	 * 根据属性key获得属性值
	 * @param key
	 * @return
	 */
	public int getAttributeAsInt(String key)
	{
		Attribute attr = getAttribute(key);
		if (attr == null)
			return 0;
		return attr.getValueAsInt();
	}

	/**
	 * 根据属性key获得属性值
	 * @param key
	 * @return
	 */
	public double getAttributeAsDouble(String key)
	{
		Attribute attr = getAttribute(key);
		if (attr == null)
			return 0.0;
        return attr.getValueAsDouble();
	}

	/**
	 * 根据属性key获得属性值
	 * @param key
	 * @return
	 */
	public boolean getAttributeAsBool(String key,boolean defaultValue)
	{
		Attribute attr = getAttribute(key);
		if (attr == null)
			return defaultValue;
		return attr.getValueAsBool();
	}

	/**
	 * 为节点指定key的属性赋值
	 * @param key 属性key
	 * @param value 属性值value
	 */
	public void setAttribute(String key, Object value)
	{
		Attribute Attrs = getAttribute(key);
		if (Attrs != null)
		{
			Attrs.setValue(value);
			return;
		}
		Attribute one=new Attribute();
		one.setKey(key);
		one.setValue(value);
		_attributes.put(key, one);
	}

	/**
	 * 转换节点值为Base64 btye[]
	 * @return
	 */
    public byte[] fromBase64String()
    {
        try {
			return SecurityUtility.fromBase64(getValueAsString());
		} catch (Exception e) {
			throw new RuntimeException(e);
		}
    }

    /**
     * 取得节点值
     * @return
     */
	public String getValueAsString()
	{
        return ConvertUtility.getValueAsString(this.value);
	}

	/**
	 * 取得节点值
	 * @return
	 */
	public int getValueAsInt()
	{
        return ConvertUtility.getValueAsInt(this.value);
	}

	/**
	 * 取得节点值
	 * @return
	 */
    public long getValueAsLong()
    {
        return ConvertUtility.getValueAsLong(this.value);
    }

    /**
     * 取得节点值
     * @return
     */
	public double getValueAsDouble()
	{
        return ConvertUtility.getValueAsDouble(this.value);
	}

	/**
	 * 取得节点值
	 */
    public Date getValueAsDateTime()
    {
        if (value == null) return FormatUtility.errorDate();
        if (value instanceof Date) return (Date)value;
        if (value instanceof LocalDateTime) {
        	return ConvertUtility.getValueAsDate(value);
        }
        String dateTimeString = this.value.toString();
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

    /**
     * 设置节点值
     * @param value
     */
	public void setValue(Object value)
	{
		this.value = value;
	}


	/**
	 * 将指定的.xml文件数据转换成HierarchicalMap类型的存储格式
	 * @param xmlFile xml文件(含全路径)
	 * @return
	 */
	public static HierarchicalMap createHierarchicalMap(String xmlFile) {
		try {
			xmlFile = URLDecoder.decode(xmlFile, "UTF-8");
		} catch (UnsupportedEncodingException e) {
			xmlFile = xmlFile.replace("%20", " ");
		}
        String xmlStr = FileUtility.getStringFromFile(xmlFile);
        return createFromXml(xmlStr, ()->{ return new SchemasDefinition(); });
	}
	
	public static HierarchicalMap createHierarchicalMapFromClassPath(String classpath){
		try{
			byte[] raw = FileUtility.getBytesFromClassPath(classpath);
			String xmlStr = new String(raw, "UTF-8");
			return createFromXml(xmlStr, ()->{ return new SchemasDefinition(); });
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}

	public static HierarchicalMap createFromXml(String xmlStr){
		return createFromXml(xmlStr, ()->{ return new SchemasDefinition(); });
	}

    /**
     * 将指定的xml格式的字符串数据转换成type类型的存储格式,type表示的类必须是HierarchicalMap的子类
     * @param xmlStr xml格式数据
     * @param instanceCreator Supplier接口对象，接口方法返回一个HierarchicalMap对象
     * @return 返回指定type的类的对象
     */
    public static HierarchicalMap createFromXml(String xmlStr, Supplier<HierarchicalMap> instanceCreator)
	{
        Document doc;
		try {
			String str = FormatUtility.sanitizeXmlString(xmlStr, " ");
			str = decorate(str);
			doc = DocumentHelper.parseText(str);
		} catch (DocumentException e) {
			throw new RuntimeException(e);
		}
		//获得根节点
		Element rootElem = doc.getRootElement();
        HierarchicalMap map = instanceCreator.get();
		getAttribute(map, rootElem);
		//递归算法,获得根节点下的所有树枝节点
		createHierarchicalMap(map, rootElem);
		return map;
	}

	/// <summary>
	/// 递归算法,获得所有子节点
	/// </summary>
	/// <param name="map">HierarchicalMap对象</param>
	/// <param name="xmlGroup">XmlNode对象</param>
    /**
     * 递归算法,获得所有子节点
     * @param map HierarchicalMap对象
     * @param xmlGroup Xml Element对象
     */
	private static void createHierarchicalMap(HierarchicalMap map, Element xmlGroup)
	{
		for(Object elemobj : xmlGroup.elements()){
			if(elemobj instanceof Element){
				Element elem = (Element) elemobj;
	            HierarchicalMap node = map.newNode(elem);
				getAttribute(node, elem);
				map.addNode(node);
				createHierarchicalMap(node, elem);
			}
		}
	}

	/**
	 * 获得每个节点的信息,如节点名称,节点值;
	 * @param group HierarchicalMap对象
	 * @param xmlNode  Xml Element对象
	 */
	private static void getAttribute(HierarchicalMap group, Element xmlNode)
	{
		group.setName(xmlNode.getName());
        group.setValue(xmlNode.getTextTrim());
        
		//保存节点属性
		for (Object attrobj : xmlNode.attributes())
		{
			if(attrobj instanceof org.dom4j.Attribute){
				org.dom4j.Attribute attr = (org.dom4j.Attribute) attrobj;
	            Attribute obj = new Attribute(attr.getName(), attr.getText().trim());
	            group._attributes.put(obj.getKey(), obj);
			}
		}

        if (group.getAttributeAsString("encoding").equalsIgnoreCase("base64"))
        {
            group.setValue(group.fromBase64String());
            group.removeAttribute("encoding");
        }

        if (group.getAttributeAsString("dataType").equalsIgnoreCase("DateTime"))
        {
            group.setValue(group.getValueAsDateTime());
            group.removeAttribute("dataType");
        }
	}


	private static String trimBranchValue(String value)
	{
		int endIndex=value.length()-1;
		for (endIndex=value.length()-1; endIndex>=0; endIndex--)
		{
			if (value.charAt(endIndex) !=' ' && 
				value.charAt(endIndex) !='\r' && 
				value.charAt(endIndex) !='\n') break;
		}
		if (endIndex>=0) return value.substring(0, endIndex+1);
		return "";
	}

	private static String decorate(String value){
		String[] ips = IPUtility.getLocalIps();
		if (ips != null && ips.length > 0)
        {
            value = value.replace("$LOCALHOST", ips[0])
                .replace("$127.0.0.1", ips[0]);
        }
		return value;
	}
	
    private static String reformat(String value)
    {
        if (value == null) return value;
        String res = value.replace("\r","").replace("\n","\r\n");
        return decorate(res);
    }

    /**
     * 根据path路径查找节点，若有多个返回第一个节点
     * @param path
     * @return
     */
	public HierarchicalMap selectSingleNode(String path)
	{
		HierarchicalMap[] result=selectNodes(path);
		if (result==null || result.length == 0) return null;
		return result[0];
	}

	/**
	 * 根据path路径查找节点
	 * @param path
	 * @return
	 */
	public HierarchicalMap[] selectNodes(String path)
	{
		int index=path.indexOf("/");
		if (index<0) return this.getNodeList(path);
		String nodeName=path.substring(0,index);
		HierarchicalMap node=this.getNode(nodeName);
		if (node==null) return new HierarchicalMap[0];
		String subPath=path.substring(index+1);
		return node.selectNodes(subPath);
	}

	/**
	 * 根据节点名称name，取得节点对象
	 * @param name 名称
	 * @return
	 */
	public HierarchicalMap getNode(String name)
	{
		HierarchicalMap map = this;
		for (int i=0;i<map.getNodesCount();i++)
		{
			HierarchicalMap tempNode=getNode(i);
            if (tempNode.getName().equals(name))
				return tempNode;
		}
		return null;
	}

	/**
	 * 根据节点索引获得节点对象HierarchicalMap,该索引从0开始
	 * @param index 索引
	 * @return HierarchicalMap 
	 */
    public HierarchicalMap getNode(int index)
    {
        HierarchicalMap map = this;
        if (index < 0 || index >= map.getNodesCount())
            return null;
        
        return ((HierarchicalMap)super.getNode(index));
    }

    /**
     * 新增指定节点(name),若存在1或n个该名称节点,则覆盖第1个节点
     * @param name 名称
     * @param value 值
     * @return
     */
    public HierarchicalMap putNode(String name, Object value)
	{
		HierarchicalMap map = getNode(name);
		if (map == null)
		{
			map = newNode(name);
			map.setName(name);
			map.setValue(value);
			this.addNode(map);
		}
		else
		{
			map.setValue(value);
		}
        return map;
	}

    /**
     * 以name创建新的节点
     * @param name 节点名称
     * @return
     */
	public HierarchicalMap newNode(String name)
	{
        HierarchicalMap node = this.createNode(name);
        node.setName(name);
        return node;
	}

	/**
	 * 以Xml节点创建新的节点
	 * @param node
	 * @return
	 */
	public HierarchicalMap newNode(Element node)
	{
        HierarchicalMap result = this.createNode(node);
		result.setName(node.getName());
		return result;
	}

	/**
	 * 获取子类的类型
	 * @param child
	 * @return {Key:对象类型，Value:构造函数参数}
	 */
    protected HierarchicalMap createNode(Element child) 
	{
        return new HierarchicalMap();
	}

    /**
     * 获取子类的类型
     * @param name
     * @return {Key:对象类型，Value:构造函数参数}
     */
    public HierarchicalMap createNode(String name){
        return new HierarchicalMap(name);
    }

    /**
     * 根据节点名称获得所有该名称节点的对象集合
     * @param name 名称
     * @return HierarchicalMap数组
     */
	public HierarchicalMap[] getNodeList(String name)
	{
		ArrayList<HierarchicalMap> list = new ArrayList<HierarchicalMap>();
		for (int i=0;i<this.getNodesCount();i++)
		{
			HierarchicalMap tempNode=getNode(i);
            if (tempNode.getName().equals(name))
				list.add(tempNode);
		}
		HierarchicalMap[] maps = new HierarchicalMap[list.size()];
		return list.toArray(maps);
	}

	/**
	 * 将对象以XML方式保存到文件
	 * @param filename 完整的文件路径
	 */
    public void saveToFile(String filename)
    {
        saveToFile(filename, "UTF-8");
    }

    /**
     * 将对象以XML方式保存到文件
     * @param filename 完整的文件路径
     * @param encode 文件的编码方式
     */
	public void saveToFile(String filename, String encode)
	{
		String data = toXml(encode);
		FileUtility.save(filename, data, encode);
	}


	/**
	 * 获取XML格式的字串，默认以UTF-8编码
	 * @return
	 */
    public String toXml()
    {
        return toXml("UTF-8");
    }

    /**
     * 获取XML格式的字串
     * @param encoding 编码方式
     * @return
     */
	public String toXml(String encoding) 
	{
		String data = getString(this, "");
        data = String.format("<?xml version=\"1.0\" encoding=\"%s\"?>%s", encoding, data);
        return data;
	}

	/**
	 * 将HierarchicalMap结构数据解析成string字符串
	 * @param map HierarchicalMap对象
	 * @param blank
	 * @return
	 */
	public static String getString(HierarchicalMap map, String blank)
	{
		StringBuilder sb = new StringBuilder();
		buildString(map, blank, sb);
		return sb.toString();
	}

	private static void buildString(HierarchicalMap map, String blank, StringBuilder sb){
		String nodeName=map.getName();
		if (nodeName=="" || nodeName==null) {
			if (map.getParent()==null) nodeName="root";
			else nodeName="node";
		}
		
		sb.append(String.format("\r\n%s<%s", blank, nodeName));
		Attribute[] attrs = map.getAttributes();
		for (int i=0;i<attrs.length;i++){
            String key = attrs[i].getKey();
            String value = ConvertUtility.getValueAsString(attrs[i].getValue());
            if(!StringUtility.isNullOrEmpty(value)){
            	value = FormatUtility.formatStringForXML(value);
            }
            sb.append(String.format(" %s=\"%s\"", key, value));
		}
		
        Object value = map.getValue();
        if (value instanceof byte[]){
            sb.append(" encoding=\"base64\"");
            value=SecurityUtility.base64((byte[])value);
        }else if (value instanceof Date){
            sb.append(" dataType=\"DateTime\"");
            value = ConvertUtility.getValueAsString(value);
        }
        if(StringUtility.isNullOrEmpty(value)){
        	value = "";
        }else{
        	value = FormatUtility.formatStringForXML(value);
        }
        
        int cnt = map.getNodesCount();
        if(cnt == 0){
        	sb.append(String.format(">%s</%s>", value, nodeName));
        }else{
        	sb.append(">");
    		for (int i=0; i<cnt; i++){
    			buildString((HierarchicalMap)map.getNode(i), blank+"  ", sb);
    			if(i == cnt-1){
        			sb.append("\r\n");
    			}
    		}
    		sb.append(String.format("%s</%s>", blank, nodeName));
        }
        
	}

	
}
