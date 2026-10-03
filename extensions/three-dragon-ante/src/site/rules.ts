/** 规则概要（传奇版 pp.6–11 的通俗转述，非印刷原文）。 */
export const RULES: Record<"zh" | "en", { title: string; body: string[] }[]> = {
  zh: [
    { title: "目标", body: ["游戏由多个轮局组成，每轮局通常打三轮，每轮每人出一张牌。某轮局结算后若有玩家金币归零，整局结束，金币最多者获胜。"] },
    { title: "一轮局怎么走", body: [
      "暗置前注：每人从手牌选一张放到自己的暗置区，全部放好后同时翻开。",
      "付前注、定领出者：每人支付最高前注点数那么多金币到奖池；忽略点数并列的牌，剩下最高者先出牌。前注牌不触发能力。",
      "顺时针出牌：从领出者开始，每人把一张手牌放到自己的牌阵，并处理这张牌触发的能力。",
      "定下一轮领出者：只比较这一轮出的牌，忽略并列，最高者领出下一轮；全部并列则原领出者继续。",
      "三轮后结算：先处理特殊牌阵奖励，再相加整个牌阵的点数，符合条件且总点数最高者拿走奖池。最高并列则所有人加打一轮。",
      "检查整局是否结束：若有人金币为零，金币最多者获胜并拿走偿债池；否则每人抽两张牌（上限十张），保留手牌，开始新轮局。",
    ] },
    { title: "能力什么时候触发", body: ["除非卡片另有说明，你这一轮打出的牌点数小于或等于逆时针相邻玩家这一轮打出的牌，能力才触发；你是这一轮第一个出牌的人时，能力正常触发。比较的只是这两张牌，不是整个牌阵。"] },
    { title: "手牌与买牌", body: ["默认起始手牌六张，手牌上限十张。自己回合开始只剩一张牌，或能力处理完后没有手牌，必须买牌：翻开牌库顶一张作为价格并弃掉，支付其点数到奖池，再补到四张手牌。"] },
    { title: "特殊牌阵", body: ["三张同色龙为同色牌阵，三张同点数为同点牌阵，三张凡人为凡人牌阵。组成时先处理这张牌的能力，再获得相应奖励；每种组合在一轮局只奖励一次。"] },
  ],
  en: [
    { title: "Goal", body: ["Play a series of gambits, normally three rounds each, one card per player per round. After a gambit is settled, if anyone has no gold, the game ends and the richest player wins."] },
    { title: "A gambit, step by step", body: [
      "Commit an ante: each player puts one hand card face down in their own ante slot. Reveal them together.",
      "Pay the ante and choose a leader: everyone pays the highest ante strength into the stakes. Ignore tied strengths; the highest remaining card leads. Antes do not trigger powers.",
      "Play clockwise: starting with the leader, each player plays one card into their flight and resolves any triggered power.",
      "Choose the next leader: compare only this round's cards, ignore ties, the highest leads. If every card is tied, the same leader continues.",
      "Settle after three rounds: resolve special-flight rewards, then add up each flight. The eligible highest total takes the stakes. Tied totals mean another round for everyone.",
      "Check for game end: if anyone has no gold, the richest wins and takes the hole. Otherwise everyone draws two cards (up to ten) and a new gambit begins.",
    ] },
    { title: "When a power triggers", body: ["Unless a card says otherwise, the card you play this round must be less than or equal to the card your counterclockwise neighbor played this round. The first card of a round always triggers. Compare those two cards only, not the whole flight."] },
    { title: "Hands and buying", body: ["Start with six cards; the hand limit is ten. With one card at the start of your turn, or no cards after powers resolve, you must buy: reveal and discard the top card as the price, pay its strength to the stakes, then draw up to four cards."] },
    { title: "Special flights", body: ["Three dragons of one color form a color flight, three cards of one strength a strength flight, three mortals a mortal flight. Resolve the played card's power first, then collect the reward; each kind rewards once per gambit."] },
  ],
};
