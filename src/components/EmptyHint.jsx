/**
 * 无数据时的占位提示。
 * @return {JSX.Element} 提示卡片
 */
export default function EmptyHint() {
  return (
    <div className="card card-pad text-center">
      <p className="text-sm font-medium text-slate-700">当前没有本地开奖数据</p>
      <p className="hint mx-auto mt-1 max-w-md">
        请到「历史数据」页导入数据，或点击「恢复内置种子数据」重新载入内置的历史开奖记录。所有统计与选号功能都依赖这份数据。
      </p>
    </div>
  );
}
