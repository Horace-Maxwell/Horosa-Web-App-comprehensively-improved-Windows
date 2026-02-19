package spacex.astrostudycn.model;

import java.util.ArrayList;
import java.util.List;

import spacex.astrostudycn.constants.ZiWeiStarType;

public class ZiWeiHouse {
	protected boolean isLife = false;
	protected boolean isBody = false;
	protected String name;
	protected String ganzi;
	protected String phase;
	protected List<ZiWeiStar> starsMain = new ArrayList<ZiWeiStar>();
	protected List<ZiWeiStar> starsAssist = new ArrayList<ZiWeiStar>();
	protected List<ZiWeiStar> starsEvil = new ArrayList<ZiWeiStar>();
	protected List<ZiWeiStar> starsOthersGood = new ArrayList<ZiWeiStar>();
	protected List<ZiWeiStar> starsOthersBad = new ArrayList<ZiWeiStar>();
	protected List<ZiWeiStar> starsSmall = new ArrayList<ZiWeiStar>();
	protected int[] direction = new int[2];
	protected List<Integer> smallDirection = new ArrayList<Integer>(); 
	protected List<Integer> beforeDirection = new ArrayList<Integer>(); 
	
	public void addStar(ZiWeiStar star, int type) {
		if(type == ZiWeiStarType.StarMain.getCode()) {
			this.starsMain.add(star);
		}else if(type == ZiWeiStarType.StarAssist.getCode()) {
			this.starsAssist.add(star);
		}else if(type == ZiWeiStarType.StarEvil.getCode()) {
			this.starsEvil.add(star);
		}else if(type == ZiWeiStarType.StarOtherGood.getCode()) {
			this.starsOthersGood.add(star);
		}else if(type == ZiWeiStarType.StarOtherBad.getCode()) {
			this.starsOthersBad.add(star);
		}else if(type == ZiWeiStarType.StarSmall.getCode()) {
			this.starsSmall.add(star);
		}
	}
	
	public void addSmallDirection(int age) {
		this.smallDirection.add(age);
	}
	
	public void addBeforeDirection(int age) {
		this.beforeDirection.add(age);
	}
	
	public Object clone() {
		ZiWeiHouse house = new ZiWeiHouse();
		house.isLife = this.isLife;
		house.isBody = this.isBody;
		house.name = this.name;
		house.ganzi = this.ganzi;
		house.phase = this.phase;
		house.starsMain = new ArrayList<ZiWeiStar>();
		house.starsAssist = new ArrayList<ZiWeiStar>();
		house.starsEvil = new ArrayList<ZiWeiStar>();
		house.direction = new int[2];
		for(int i=0; i<house.direction.length; i++) {
			house.direction[i] = this.direction[i];
		}
		
		house.starsMain.addAll(this.starsMain);
		house.starsAssist.addAll(this.starsAssist);
		house.starsEvil.addAll(this.starsEvil);
		house.starsOthersGood.addAll(this.starsOthersGood);
		house.starsOthersBad.addAll(this.starsOthersBad);
		house.starsSmall.addAll(this.starsSmall);

		house.smallDirection.addAll(this.smallDirection);
		house.beforeDirection.addAll(this.beforeDirection);

		return house;
	}
}
