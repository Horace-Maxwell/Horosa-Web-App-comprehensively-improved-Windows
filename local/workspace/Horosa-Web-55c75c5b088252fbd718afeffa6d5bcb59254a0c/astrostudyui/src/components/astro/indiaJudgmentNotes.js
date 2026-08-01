// 印占「判读要点」静态卡(W2):文本逐字取自权威技术文档对应节,仅去除章节号交叉引用(界面零 § 铁律)。
// 纯常量、零算法、不进后端、不进缓存键、不入 AI 快照(快照是 ground-truth 数值源,解读属 AI 职责)。
// 结构 {tabKey: [{title, lines[]}]};消费方在对应右栏 tab 面板底部渲染(复用 horosa-info-card,不新增 CSS)。

const INDIA_JUDGMENT_NOTES = {
	// 大运 tab
	'3': [
		{
			title: '大运吉凶判读要点',
			lines: [
				'运主（mahā/antar）在本命的落宫、宫主关系、Yoga 参与、Ṣaḍbala、Aṣṭakavarga 点共同决定吉凶。',
				'Dāśā-sandhi（运交界）常应吉凶转折事件。',
				'过运（Gochara）+ 大运双确认；月运/日运用于精确择时。',
				'功能吉凶星（Yogakāraka/Māraka/Bādhaka）随上升星座而定。',
			],
		},
		{
			title: '审慎提示',
			lines: [
				'涉及健康、寿命、婚姻等敏感判断应留有余地、避免决定论。',
			],
		},
	],
	// KP/择时 tab
	'6': [
		{
			title: 'KP 应事判定流程',
			lines: [
				'1) 定问题对应宫（结婚=2,7,11；事业=2,6,10,11；出国=3,9,12…）',
				'2) 看这些宫的 CSL 是否指示该组吉宫 → 事是否「被许诺」',
				'3) 取相关宫「指示星」交集',
				'4) 在 Viṃśottarī（到子/孙/Sūkṣma 层）找「指示星层叠」之时段 → 应期',
				'5) 用 RP / 过运 二次确认',
			],
		},
	],
	// Yoga tab
	'7': [
		{
			title: 'Rāja Yoga 成立与解破',
			lines: [
				'Kendra-Trikoṇa Rāja Yoga：角宫主（1,4,7,10 之主）与三方主（1,5,9 之主）之间发生 同宫/互照/互换(parivartana) → 权位、成功。',
				'Dharma-Karmādhipati Yoga：第9宫主 与 第10宫主 结合 → 最强 Rāja Yoga 之一。',
				'Nīcabhaṅga Rāja Yoga（弱陷解除转贵）：弱陷星之「陷」被解 → 反成大贵。解除条件（满足其一）：弱陷星的陷宫主居 自/月之角宫；在该宫得旺之星居角宫；弱陷星与其调主(dispositor)同宫/互照；弱陷星在月/Lagna 之角宫且旺主同在。',
				'Vipareīta Rāja Yoga（逆境生贵）：6/8/12 宫主落入 6/8/12（彼此）→ 意外崛起。三型：Harṣa(6主)、Sarala(8主)、Vimala(12主)。',
			],
		},
		{
			title: '财 Dhana / 贫 Daridra / 厄 Ariṣṭa',
			lines: [
				'Dhana Yoga：财宫（1,2,5,9,11）主之间结合；尤 2主+11主；Lakṣmī Yoga（9主有力+金星旺）→ 富。',
				'Daridra Yoga：得益之 11主落 6/8/12；财宫主落凶宫并受凶 → 贫困、负债。',
				'Ariṣṭa / Bālāriṣṭa：月受凶星夹/相而无吉救、Lagna 与月皆弱 → 体弱类；多有吉星相解(bhaṅga)。判读须谨慎、忌机械下断。',
			],
		},
		{
			title: '功能吉凶与 Māraka / Bādhaka（随上升而定）',
			lines: [
				'功能吉星：对该 Lagna 而言主管吉宫（尤三方）之星；功能凶星：主管凶宫（3,6,8,11，尤其只主凶宫）之星。随 12 个 Lagna 不同而不同（如金牛 Lagna：土为吉、木为凶）。',
				'Māraka（夺命星）：第2、7宫及其主为 māraka，于不利大运可应病灾。',
				'Bādhaka（障碍星/宫）：动象 Lagna → 第11宫/主；固定 Lagna → 第9宫/主；双体 Lagna → 第7宫/主。',
			],
		},
		{
			title: 'Nābhasa Ākṛti 20 格局（依行星布列形状）',
			lines: [
				'Gadā(杵)、Śakaṭa(车)、Vihaga/Pakṣi(鸟)、Vajra(金刚杵)、Yava(麦)、Kamala(莲)、Vāpī(井)、Yūpa(柱)、Śara(箭)、Śakti(矛)、Daṇḍa(杖)、Naukā(舟)、Kūṭa(峰)、Chatra(伞)、Cāpa(弓)、Ardhacandra(半月)、Cakra(轮)、Samudra(海)等——各依星落在哪些宫的几何排布判定，给相应秉性/命运基调。',
			],
		},
		{
			title: '含义提示',
			lines: [
				'Yoga 须看参与星的力量(Ṣaḍbala)、是否合日/受凶、所落分盘、所辖大运综合定「成色」与「应期」；孤立断语不可取。涉及健康、寿命、婚姻等敏感判断应留有余地、避免决定论。',
			],
		},
	],
	// 映象(Jaimini) tab
	'9': [
		{
			title: 'Jaimini 判读骨架',
			lines: [
				'以 Kārakāṃśa + Arudha 体系 + Rāśi Dṛṣṭi + Argala + Chara 大运联判：AK 定灵魂课题，AmK 定事业，UL 定婚姻，AL 定社会形象；星座相位与 Argala 决定「谁影响谁」；Chara 大运定「何时」。',
			],
		},
	],
	// 年度(Tājika) tab
	'11': [
		{
			title: 'Varṣaphala 判读骨架',
			lines: [
				'Varṣeśa 定全年主调；Muntha 宫定当年焦点领域；Sahams 定专题吉凶点位；Tājika Yoga（尤 Ithaśāla/Iśarapha）定「事成/事败」；Mudda/Patyāyinī 定月段应期。须与本命大运叠合确认。',
			],
		},
	],
};

export default INDIA_JUDGMENT_NOTES;
