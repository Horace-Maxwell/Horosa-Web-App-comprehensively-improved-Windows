package boundless.model;

import java.io.Serializable;
import java.util.HashMap;
import java.util.Map;

import boundless.utility.JsonUtility;

public class TreeNode implements Serializable {
	private static final long serialVersionUID = 2783758591858330253L;

	protected Map<Object, Object> extraData=new HashMap<Object, Object>();
	private boolean html=false;
	private String imageUrl;
	private String caption;
	private String text;
	private String transCode;
	private String id;
	private boolean expanded= false;
	
	transient private TreeNode parent;
	transient private TreeNode nextNode;
	transient private TreeNode prevNode;

	private TreeNodeList nodes = new TreeNodeList();
	
	public TreeNode(){
		
	}
	
	public TreeNode(String caption)
	{
		this(caption, false);
	}

	public TreeNode(String caption,boolean html)
	{
		this.html=html;
		this.caption = caption;
		this.text = caption;
	}
	
	public TreeNode getParent(){
		return this.parent;
	}
	
	void setParent(TreeNode parent){
		this.parent = parent;
	}

	public TreeNode getNextNode(){
		return this.nextNode;
	}
	
	void setNextNode(TreeNode node){
		this.nextNode = node;
	}
	
	public TreeNode getPrevNode(){
		return this.prevNode;
	}
	
	void setPrevNode(TreeNode node){
		this.prevNode = node;
	}
	

	/**
	 * 获得当前结点扩展信息
	 * @return
	 */
	public Map<Object, Object> getExtraData() {return extraData;}

	/**
	 * 标签是否为html代码形式
	 * @return
	 */
	public boolean isHtmlCaption() {return html;}


	/**
	 * 结点对应的图标
	 * @return
	 */
	public String getImageUrl()
	{
		return imageUrl;
	}
	
	public void setImageUrl(String value){
		imageUrl=value;
	}

	/**
	 * 结点对应html代码
	 * @return
	 */
	public boolean isHtml()
	{
		return html;
	}

	public void setHtml(boolean value){
		html=value;
	}

	/**
	 * @return the caption
	 */
	public String getCaption() {
		return caption;
	}

	/**
	 * @param caption the caption to set
	 */
	public void setCaption(String caption) {
		this.caption = caption;
	}

	/**
	 * @return the text
	 */
	public String getText() {
		return text;
	}

	/**
	 * @param text the text to set
	 */
	public void setText(String text) {
		this.text = text;
	}
	
	public boolean isExpanded(){
		return expanded;
	}
	
	public void toggle(){
		expanded = !expanded;
	}
	
	
	public void addExtraData(String key, Object obj){
		extraData.put(key, obj);
	}
	
	public void removeExtraData(String key){
		extraData.remove(key);
	}
	
	public void clearExtraData(){
		extraData.clear();
	}
	
	
	public void addNode(TreeNode node){		
		if(nodes.add(node)){
			node.setParent(this);
		}
	}
	
	public void addNode(int index, TreeNode node){
		nodes.add(index, node);
		node.setParent(this);
	}
	
	public void removeNode(TreeNode node){
		if(nodes.remove(node)){
			node.setPrevNode(null);
			node.setNextNode(null);
			node.setParent(null);
		}
	}
	
	public void removeNode(int index){
		TreeNode node = nodes.remove(index); 
		if(node != null){
			node.setPrevNode(null);
			node.setNextNode(null);
			node.setParent(null);
		}
	}
	
	public TreeNode getNode(int i){
		return nodes.get(i);
	}
	
	public int getNodesCount(){
		return nodes.size();
	}

	public String getTransCode() {
		return transCode;
	}

	public void setTransCode(String transCode) {
		this.transCode = transCode;
	}

	public String getId() {
		return id;
	}

	public void setId(String id) {
		this.id = id;
	}

	public TreeNodeList getNodes() {
		return nodes;
	}
	
	public String getJsonString(){
		return JsonUtility.encode(this);
	}
}
