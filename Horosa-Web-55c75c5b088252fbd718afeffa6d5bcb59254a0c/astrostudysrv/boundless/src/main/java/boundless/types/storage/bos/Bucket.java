package boundless.types.storage.bos;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

import com.baidubce.services.bos.BosClient;
import com.baidubce.services.bos.model.BucketSummary;
import com.baidubce.services.bos.model.CannedAccessControlList;
import com.baidubce.services.bos.model.Grant;
import com.baidubce.services.bos.model.Grantee;
import com.baidubce.services.bos.model.Permission;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.utility.JsonUtility;

/**
 * 百度BOS服务器Bucket容器对象
 * <p>
 * Title:Bucket
 * </p>
 * <p>
 * Company: 91zm
 * </p>
 * 
 * @author guandesong_dian91
 * @date 2016-1-12上午10:56:01
 */
public class Bucket {
	/**
	 * 创建bucket
	 * 
	 * @param client
	 * @param bucketName
	 */
	public void createBucket(BosClient client, String bucketName) {
		// 新建一个Bucket
		client.createBucket(bucketName);
	}

	/**
	 * 获取bucket列表
	 * 
	 * @param client
	 */
	public void listBuckets(BosClient client, Consumer<BucketSummary> handler) {
		// 获取用户的Bucket列表
		List<BucketSummary> buckets = client.listBuckets().getBuckets();

		// 遍历Bucket
		for (BucketSummary bucket : buckets) {
			if(handler != null){
				try{
					handler.accept(bucket);
				}catch(Exception e){
					QueueLog.error(AppLoggers.ErrorLogger, e);
				}
			}
		}
	}

	/**
	 * 判断Bucket是否存在
	 * 
	 * @param client
	 * @param bucketName
	 */
	public boolean doesBucketExist(BosClient client, String bucketName) {

		// 获取Bucket的存在信息
		boolean exists = client.doesBucketExist(bucketName);

		// 输出结果
		if (exists) {
			QueueLog.debug(AppLoggers.DebugLogger, "Bucket exists");
		} else {
			QueueLog.debug(AppLoggers.DebugLogger, "Bucket not exists");
		}
		return exists;
	}

	/**
	 * 删除Bucket
	 * 
	 * @param client
	 * @param bucketName
	 */
	public void deleteBucket(BosClient client, String bucketName) {
		// 删除Bucket
		client.deleteBucket(bucketName);
	}

	/**
	 * 设置Bucket的访问权限
	 * 
	 * @param client
	 * @param bucketName
	 */
	public void setBucketPrivate(BosClient client, String bucketName) {
		client.setBucketAcl(bucketName, CannedAccessControlList.Private);
	}

	/**
	 * 设置指定用户对Bucket的访问权限
	 * 
	 * @param client
	 */
	public void setBucketAclFromBody(BosClient client, String bucketName, List<Permission> permission, String... users) {
		if(users == null || users.length == 0){
			return;
		}
		
		List<Grant> grants = new ArrayList<Grant>();
		List<Grantee> grantee = new ArrayList<Grantee>();

		// 授权给特定用户
		for(String user : users){
			grantee.add(new Grantee(user));
		}
		// 授权给Everyone
//		grantee.add(new Grantee("*"));

		grants.add(new Grant().withGrantee(grantee).withPermission(permission));
		client.setBucketAcl(bucketName, JsonUtility.encode(grants));
	}
}
