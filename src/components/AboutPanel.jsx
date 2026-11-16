/**
 * 说明与免责面板。
 * @param {{meta: object, drawsCount: number}} props 数据说明
 * @return {JSX.Element} 面板
 */
export default function AboutPanel({ meta, drawsCount }) {
  const firstNo = meta && meta.first_no ? meta.first_no : '—';
  const lastNo = meta && meta.last_no ? meta.last_no : '—';
  const firstDate = meta && meta.first_date ? meta.first_date : '—';
  const lastDate = meta && meta.last_date ? meta.last_date : '—';

  return (
    <div className="space-y-4">
      <div className="card card-pad">
        <h2 className="section-title">玩法说明</h2>
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-700">
          <li>· 前区：从 01-35 中选 5 个号码；后区：从 01-12 中选 2 个号码。</li>
          <li>· 单注金额 2 元（追加投注另算，本工具不涉及投注功能）。</li>
          <li>
            · 一等奖（5+2）单注命中概率 = 1 / C(35,5) × 1 / C(12,2) = 1 / 324,632 × 1 / 66 ={' '}
            <strong className="text-red-600">1 / 21,425,712</strong>。
          </li>
          <li>· 每期开奖相互独立，往期结果不影响下一期。</li>
        </ul>
      </div>

      <div className="card card-pad">
        <h2 className="section-title">数据来源</h2>
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-700">
          <li>
            · 来源：中国体彩网官方开奖数据接口 webapi.sporttery.cn（gameNo = 85，即超级大乐透）。
          </li>
          <li>
            · 内置种子：{drawsCount} 期，期号 {firstNo} ~ {lastNo}，日期 {firstDate} ~ {lastDate}。
          </li>
          <li>· 数据仅用于本地统计演示；本工具不联网、不提交任何数据、不提供投注功能。</li>
          <li>
            · 若官方已开奖而本地数据未更新，可通过「历史数据」页导入最新数据（txt / csv / json）。
          </li>
          <li>
            · 说明：内置数据经卡方检验显示与均匀分布存在统计偏离（前区 χ² ≈ 89.4，df =
            34）。这既可能源于历史规则变化，
            也可能源于数据合成/录入偏差；它同样不能用于预测下期结果，请勿据此购彩。
          </li>
        </ul>
      </div>

      <div className="card card-pad">
        <h2 className="section-title">统计学说明：这些指标的真实含义</h2>
        <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-700">
          <div>
            <p className="font-medium text-slate-800">1. 频率与冷热</p>
            <p className="mt-0.5 text-slate-600">
              频率统计描述的是历史记录。因为每期独立随机，号码的长期出现率会趋近理论概率（前区
              14.29%），但短期内没有任何机制让「冷号」回补。 卡方检验出现 p &lt; 0.05
              时，多半来自多重比较和样本波动，不能作为选号依据。
            </p>
          </div>
          <div>
            <p className="font-medium text-slate-800">2. 遗漏值与赌徒谬误</p>
            <p className="mt-0.5 text-slate-600">
              遗漏值衡量「连续多少期没出现」。把高遗漏理解为「该出了」是最典型的赌徒谬误：每次开奖都是独立事件，
              连续 30 期未出现的号码，下期出现概率仍然是 14.29%（前区单号）。
            </p>
          </div>
          <div>
            <p className="font-medium text-slate-800">3. 样本内过拟合与多重比较</p>
            <p className="mt-0.5 text-slate-600">
              在 2941 期数据上测试几十条规则，总能找到「回测有效」的规则——这是典型的样本内过拟合。
              同时检验 35 个号码时，即使全部均匀，也约有 1-2 个号码的 |z| 会超过 2（多重比较问题）。
              这类「规律」在样本外通常立刻失效。
            </p>
          </div>
          <div>
            <p className="font-medium text-slate-800">4. 选号策略能做什么、不能做什么</p>
            <p className="mt-0.5 text-slate-600">
              本工具的选号功能是用可复现的伪随机算法生成号码，并把筛选条件（冷热池、遗漏池、奇偶比、大小比、和值区间等）作为
              抽样的偏好。它改变的是「你看到哪些号码」，而不是「哪些号码更容易开出来」。
              任何组合（包括历史从未开出的组合）中头奖的概率都完全相同：1 / 21,425,712。
              多期回测只是把这件事在历史窗口上重复一遍，用途是检验「策略与随机到底有没有区别」——
              正常情况下结论都是没有区别；它不能用来挑选下一期的号码。
            </p>
          </div>
          <div>
            <p className="font-medium text-slate-800">5. 期望值</p>
            <p className="mt-0.5 text-slate-600">
              彩票的返奖率低于
              100%，长期购买的期望收益为负。购买彩票应当被视为娱乐消费，而不是投资。
            </p>
          </div>
        </div>
      </div>

      <div className="card card-pad border-amber-300 bg-amber-50">
        <h2 className="section-title text-amber-900">完整免责声明</h2>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-amber-900">
          <p>
            彩票开奖具有随机性，每一期开奖结果相互独立，历史数据无法用于推断或提高下一期的中奖概率。
            本软件为个人学习与统计展示用途的开源工具，所有频率统计、冷热分析、遗漏计算、走势图表、随机选号与多期回测结果
            <strong>均仅供参考娱乐，不构成任何购彩依据、投资建议或中奖承诺</strong>。
          </p>
          <p>
            本软件不销售彩票、不代购、不提供任何投注或兑奖服务，与任何彩票发行机构、销售机构均无关联。
            使用者因参考本软件内容而产生的任何直接或间接损失，软件作者不承担任何责任。
          </p>
          <p>
            请通过中国体育彩票官方渠道（实体投注站或官方授权渠道）购买彩票。请理性购彩、量力而行、切勿沉迷；
            <strong>未成年人不得购买彩票或兑奖</strong>
            。若您或家人出现无法控制的购彩行为，请及时寻求帮助。
          </p>
          <p>
            数据来源：中国体彩网官方开奖数据接口（webapi.sporttery.cn，gameNo =
            85）。若数据存在遗漏或错误， 以官方公布的开奖结果为准。
          </p>
        </div>
      </div>

      <div className="card card-pad">
        <h2 className="section-title">隐私与技术说明</h2>
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-700">
          <li>
            · 所有数据保存在你的浏览器
            localStorage（key：dlt_predictor_draws_v1），不上传任何服务器。
          </li>
          <li>· 本工具为纯前端单页应用，构建后可离线通过 file:// 打开使用。</li>
          <li>
            · 选号使用 mulberry32 伪随机数生成器：相同随机种子 + 相同参数 ⇒
            完全相同的结果，便于核对与复现。
          </li>
          <li>· 统计计算（含卡方检验 p 值）均为自实现，不依赖第三方统计库。</li>
        </ul>
      </div>
    </div>
  );
}
