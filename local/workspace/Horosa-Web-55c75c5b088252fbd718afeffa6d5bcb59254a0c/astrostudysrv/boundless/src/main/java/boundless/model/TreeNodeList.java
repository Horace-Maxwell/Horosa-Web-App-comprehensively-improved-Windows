package boundless.model;

import java.util.LinkedList;

public class TreeNodeList extends LinkedList<TreeNode> {
	private static final long serialVersionUID = 646658551907213998L;

	/* (non-Javadoc)
	 * @see java.util.LinkedList#removeFirst()
	 */
	@Override
	public TreeNode removeFirst() {
		TreeNode node = super.pollFirst();
		if(node != null){
			node.getNextNode().setPrevNode(null);
		}
		return node;
	}

	/* (non-Javadoc)
	 * @see java.util.LinkedList#removeLast()
	 */
	@Override
	public TreeNode removeLast() {
		TreeNode node = super.removeLast();
		if(node != null){
			node.getPrevNode().setNextNode(null);
		}
		return node;
	}

	/* (non-Javadoc)
	 * @see java.util.LinkedList#add(java.lang.Object)
	 */
	@Override
	public boolean add(TreeNode node) {
		TreeNode lastNode = this.peekLast();
		boolean flag = super.add(node);
		if(flag){
			if(lastNode != null){
				lastNode.setNextNode(node);
			}
			node.setPrevNode(lastNode);
			node.setNextNode(null);			
		}
		return flag;
	}

	/* (non-Javadoc)
	 * @see java.util.LinkedList#remove(java.lang.Object)
	 */
	@Override
	public boolean remove(Object o) {
		boolean flag = super.remove(o);
		if(flag){
			TreeNode node = (TreeNode) o;
			node.getPrevNode().setNextNode(node.getNextNode());
			node.getNextNode().setPrevNode(node.getPrevNode());
		}
		return flag;
	}

	/* (non-Javadoc)
	 * @see java.util.LinkedList#add(int, java.lang.Object)
	 */
	@Override
	public void add(int index, TreeNode element) {
		TreeNode node = this.get(index);
		super.add(index, element);
		element.setPrevNode(node);
		element.setNextNode(node.getNextNode());
		node.setNextNode(element);
	}

	/* (non-Javadoc)
	 * @see java.util.LinkedList#remove(int)
	 */
	@Override
	public TreeNode remove(int index) {
		TreeNode node = super.remove(index);
		if(node != null){
			node.getPrevNode().setNextNode(node.getNextNode());
			node.getNextNode().setPrevNode(node.getPrevNode());			
		}
		return node;
	}

	/* (non-Javadoc)
	 * @see java.util.LinkedList#set(int, java.lang.Object)
	 */
	@Override
	public TreeNode set(int index, TreeNode element) {
		TreeNode node = super.set(index, element);
		if(node != null){
			element.setPrevNode(node.getPrevNode());
			element.setNextNode(node.getNextNode());
		}
		return node;
	}

	/* (non-Javadoc)
	 * @see java.util.LinkedList#poll()
	 */
	@Override
	public TreeNode poll() {
		TreeNode node = super.poll();
		if(node != null){
			node.getNextNode().setPrevNode(null);
		}
		return node;
	}

	/* (non-Javadoc)
	 * @see java.util.LinkedList#pollFirst()
	 */
	@Override
	public TreeNode pollFirst() {
		TreeNode node = super.pollFirst();
		if(node != null){
			node.getNextNode().setPrevNode(null);
		}
		return node;
	}

	/* (non-Javadoc)
	 * @see java.util.LinkedList#pollLast()
	 */
	@Override
	public TreeNode pollLast() {
		TreeNode node = super.pollLast();
		if(node != null){
			node.getPrevNode().setNextNode(null);
		}
		return node;
	}

	/* (non-Javadoc)
	 * @see java.util.LinkedList#push(java.lang.Object)
	 */
	@Override
	public void push(TreeNode e) {
		addFirst(e);
	}

	/* (non-Javadoc)
	 * @see java.util.LinkedList#pop()
	 */
	@Override
	public TreeNode pop() {
		return removeFirst();
	}

	/* (non-Javadoc)
	 * @see java.util.LinkedList#addFirst(java.lang.Object)
	 */
	@Override
	public void addFirst(TreeNode e) {
		TreeNode node = this.getFirst();
		super.addFirst(e);
		if(node != null){
			node.setPrevNode(e);
			e.setNextNode(node);
		}else{
			e.setNextNode(null);
		}
		e.setPrevNode(null);
	}

	/* (non-Javadoc)
	 * @see java.util.LinkedList#addLast(java.lang.Object)
	 */
	@Override
	public void addLast(TreeNode e) {
		TreeNode node = this.getLast();
		super.addLast(e);
		if(node != null){
			node.setNextNode(e);
			e.setPrevNode(node);
		}else{
			e.setPrevNode(null);
		}
		e.setNextNode(null);
	}

	
}
