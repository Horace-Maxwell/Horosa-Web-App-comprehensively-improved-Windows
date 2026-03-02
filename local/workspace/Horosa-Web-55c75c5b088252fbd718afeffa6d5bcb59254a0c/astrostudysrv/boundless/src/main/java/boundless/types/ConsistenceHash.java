package boundless.types;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import boundless.function.Consumer2;
import boundless.function.Consumer2Delegate;
import boundless.function.Consumer3;
import boundless.function.Consumer3Delegate;

/**
 * 一致性哈希。线程不安全
 * @author zjf
 *
 * @param <T_Item>
 */
public class ConsistenceHash<T_Item> {
	/**
	 * 节点可用或不可用时触发数据迁移。<br />
	 * 参数1:从哪个节点转移出来的节点ID，参数2:转移到哪个节点里去的节点ID，参数3:被转移的数据
	 */
	private Consumer3Delegate<Integer, Integer, T_Item[]> _onMigration;
	
	/**
	 * 节点可用时触发。<br />
	 * 参数1:可用节点ID，参数2:未转移出去的数据
	 */
	private Consumer2Delegate<Integer, T_Item[]> _onAvailable;
	
	/**
	 * 节点失效时触发。<br />
	 * 参数1:失效节点ID，参数2:未转移出去的数据
	 */
	private Consumer2Delegate<Integer, T_Item[]> _onUnavailable;
	
	private CircleNode<T_Item>[] _circleNodes = null;
	private IAssistant<T_Item> _assistant;
	
	/**
	 * 用节点id数组构造一致性hash表，节点id必须是正整数。
	 * @param nodeIds
	 */
	public ConsistenceHash(int[] nodeIds,IAssistant<T_Item> assistant) {
		this._assistant=assistant;
		
		_onMigration = new Consumer3Delegate<Integer, Integer, T_Item[]>();
		_onAvailable = new Consumer2Delegate<Integer, T_Item[]>();
		_onUnavailable = new Consumer2Delegate<Integer, T_Item[]>();
		
        _circleNodes = new CircleNode[nodeIds.length];

        for (int i = 0; i < _circleNodes.length; i++)
        {
            _circleNodes[i] = new CircleNode(i, nodeIds[i]);
        }

        for (int i = 1; i < _circleNodes.length; i++)
        {
            _circleNodes[i].setPoint(_circleNodes[i-1]);
        }

        _circleNodes[0].setPoint(_circleNodes[_circleNodes.length - 1]);
	}

	/**
	 * 获得item目前所处的节点
	 * @param item
	 * @return 当前数据所在的有效的节点id。如果为0，则说明所有节点都无效。
	 */
    public int getAvailableNodeId(T_Item item)
    {
        CircleNode<T_Item> birthNode = assignBirthNode(item);
        if (birthNode.isAvailable()) return birthNode.getNodeId();
        
        CircleNode<T_Item> pointNode = birthNode.getPoint();
        while (pointNode != null && pointNode != birthNode)
        {
            if (pointNode.isAvailable()) return pointNode.getNodeId();
            pointNode = pointNode.getPoint();
        }
        return 0;
    }

    /**
     * 把item放入
     * @param item
     * @return
     */
    public int putItem(T_Item item)
    {
        CircleNode<T_Item> birthNode = assignBirthNode(item);
        CircleNode<T_Item> availableNode = getAvailableNode(item);
        NodeItem<T_Item> nodeItem = new NodeItem<T_Item>() ;
        nodeItem.birthIndex = birthNode.getCircleIndex();
        nodeItem.tag = item;
        
        if (availableNode != null)
        {
            availableNode.addItem(nodeItem);
            return availableNode.getNodeId();
        }
        else
        {
            birthNode.addItem(nodeItem);
            return birthNode.getNodeId();
        }
    }
    
    public int size(){
    	return _circleNodes.length;
    }
    
    public Object[] getItems(int nodeIndex){
    	List res = new ArrayList();
    	CircleNode node = _circleNodes[nodeIndex];
    	
    	NodeItem[] items = node.getItems();
    	for(NodeItem item : items){
    		res.add(item.tag);
    	}
    	
    	return res.toArray();
    }
    
    public boolean isAvailable(int nodeIndex){
    	return _circleNodes[nodeIndex].isAvailable();
    }
    
    public String toString(){
    	StringBuilder sb = new StringBuilder();
    	
    	for(CircleNode node : _circleNodes){
    		NodeItem[] items = node.getItems();
    		sb.append("Node ").append(node.getNodeId()).append(node.isAvailable() ? " available" : " unavailable").append(", ");
    		sb.append(" with data :");
    		for(NodeItem item : items){
    			sb.append("\t").append(item.tag).append(" ;\t");
    		}
    		sb.append("\r\n");
    	}
    	return sb.toString();
    }
    
    /**
     * 移除item
     * @param item
     */
    public void removeItem(T_Item item)
    {
        CircleNode<T_Item> availableNode = getAvailableNode(item);
        if (availableNode != null)
        {
            availableNode.removeItem(item);
            return;
        }

        for(CircleNode<T_Item> node : _circleNodes){
            if (node.removeItem(item)) return;
        }
    }

    
    private CircleNode<T_Item> getAvailableNode(T_Item item)
    {
        CircleNode<T_Item> birthNode = assignBirthNode(item);
        if (birthNode.isAvailable()) return birthNode;
        
        CircleNode<T_Item> pointNode = birthNode.getPoint();
        while (pointNode != null && pointNode != birthNode)
        {
            if (pointNode.isAvailable()) return pointNode;
            pointNode = pointNode.getPoint();
        }
        return null;
    }

    private CircleNode<T_Item> assignBirthNode(T_Item id)
    {
        int size = _circleNodes.length;
        int hashCode = id.hashCode() & 0x7fffffff;
        int index = (hashCode % 1024) % size;
        if (index >= size) index = 0;
        
        return _circleNodes[index];
    }
    
    public void addOnAvailable(Consumer2<Integer, T_Item[]> consumer){
    	this._onAvailable.add(consumer);
    }
    
    public void addOnUnavailable(Consumer2<Integer, T_Item[]> consumer){
    	this._onUnavailable.add(consumer);
    }
    
    public void addOnMigration(Consumer3<Integer, Integer, T_Item[]> consumer){
    	this._onMigration.add(consumer);
    }
    
    /**
     * 设置节点是否可用
     * @param nodeId
     * @param available
     */
    public void setAvailable(int nodeId, boolean available)
    {
        CircleNode targetNode=null;
        for (int i = 0; i < _circleNodes.length; i++)
        {
            if (_circleNodes[i].getNodeId() == nodeId)
            {
                targetNode = _circleNodes[i];
                break;
            }
        }

        if (targetNode == null || targetNode.isAvailable()==available) return;

        targetNode._available = available;
        List<T_Item> itemList = new ArrayList<T_Item>();
        for(NodeItem<T_Item> item : targetNode.getItems()){
        	itemList.add(item.tag);
        }
        
        T_Item[] items=_assistant.newItemArray(itemList.size());
        itemList.toArray(items);
        
        if (available && _onAvailable != null)
        {
            _onAvailable.execute(nodeId, items);
        }else if(!available && _onUnavailable != null){
        	_onUnavailable.execute(nodeId, items);
        }

        CircleNode backupNode = targetNode.getPoint();
        while (backupNode != null && backupNode != targetNode)
        {
            if (backupNode.isAvailable()) break;
            backupNode = backupNode.getPoint();
        }

        //之前都不可用，则把所有的都迁移过来
        if (backupNode == targetNode)
        {
            if (!available) return;

            for(CircleNode node : _circleNodes){
                if (node == targetNode) continue;
                migrationItems(node, targetNode);
            }
            return;
        }
        
        //可用时，把原本从本节点迁移出去的数据再迁移回来
        List<T_Item> migrationItemList = new ArrayList<T_Item>();
        if (available)
        {
            for (NodeItem<T_Item> item : backupNode.getItems())
            {
                if (!needMigration(item,backupNode, targetNode)) continue;
                migrationItemList.add(item.tag);
                targetNode.addItem(item);
                backupNode.removeItem(item.tag);
            }

            T_Item[] migrationItems=_assistant.newItemArray(migrationItemList.size());
            migrationItemList.toArray(migrationItems);
            
            if (migrationItems.length>0 && _onMigration != null) 
            	_onMigration.execute(backupNode.getNodeId(), targetNode.getNodeId(), migrationItems);
            return;
        }

        //不可用时，把本节点的数据迁移到备援节点
        migrationItemList.clear();
        for (NodeItem<T_Item> item : targetNode.getItems())
        {
        	migrationItemList.add(item.tag);
            backupNode.addItem(item);
            targetNode.removeItem(item.tag);
        }

        T_Item[] migrationItems=_assistant.newItemArray(migrationItemList.size());
        migrationItemList.toArray(migrationItems);
        if (migrationItems.length > 0 && _onMigration != null) 
        	_onMigration.execute(targetNode.getNodeId(), backupNode.getNodeId(), migrationItems);
    }

    private boolean needMigration(NodeItem<T_Item> item, CircleNode<T_Item> fromNode, CircleNode<T_Item> toNode)
    {
        CircleNode<T_Item> node = _circleNodes[item.birthIndex];
        while (node != null)
        {
            if (node==fromNode) return false;
            if (node == toNode) return true;
            node = node.getPoint();
        }
        
        return false;
    }

    private void migrationItems(CircleNode<T_Item> fromNode, CircleNode<T_Item> toNode)
    {
        List<T_Item> migrationItemList = new ArrayList<T_Item>();

        for(NodeItem<T_Item> item : fromNode.getItems())
        {
        	migrationItemList.add(item.tag);
            toNode.addItem(item);
            fromNode.removeItem(item.tag);
        }

        T_Item[] migrationItems=_assistant.newItemArray(migrationItemList.size());
        migrationItemList.toArray(migrationItems);
        
        if (migrationItems.length > 0 && _onMigration != null) 
        	_onMigration.execute(fromNode.getNodeId(), toNode.getNodeId(), migrationItems);
        
        return;
    }

    
	private class CircleNode<T_Item> {
		private Map<T_Item, NodeItem<T_Item>> _itemDic = new HashMap<T_Item, NodeItem<T_Item>>();
		private int _circleIndex;
		private int _nodeId;
		private boolean _available;
		private CircleNode<T_Item> _point;
		
        public CircleNode(int index, int nodeId)
        {
        	_circleIndex = index;
        	_nodeId = nodeId;
        	_available = false;
        }
        
        public int getCircleIndex(){
        	return _circleIndex;
        }

        public int getNodeId(){
        	return _nodeId;
        }
        
        public boolean isAvailable(){
        	return _available;
        }
        
        public CircleNode<T_Item> getPoint(){
        	return this._point;
        }
        
        public void setPoint(CircleNode<T_Item> node){
        	this._point = node;
        }
        
        public NodeItem[] getItems(){
        	NodeItem[] items = new NodeItem[_itemDic.size()];
        	return _itemDic.values().toArray(items);
        }
        
        public void clear(){
        	_itemDic.clear();
        }
        
        public void addItem(NodeItem<T_Item> item)
        {
            _itemDic.put(item.tag, item);
        }

        public boolean removeItem(T_Item item)
        {
            return _itemDic.remove(item) != null;
        }
	}
	
	private class NodeItem<T_Item> {
		public int birthIndex;
		public T_Item tag;
	}
	
	public static interface IAssistant<T_Item>{
		T_Item[] newItemArray(int count);
	}
}
