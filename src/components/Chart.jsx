import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

/**
 * 轻量 ECharts 封装（不依赖 echarts-for-react）。
 *
 * - 只在挂载时 init 一次，之后通过 setOption(option, true) 更新；
 * - 监听容器尺寸变化（ResizeObserver）与窗口 resize，自动 resize；
 * - 卸载时 dispose，避免内存泄漏。
 *
 * @param {{option: object, height?: number|string, className?: string, ariaLabel?: string}} props
 * @return {JSX.Element} 图表容器
 */
export default function Chart({ option, height = 320, className = '', ariaLabel = '统计图表' }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    const instance = echarts.init(node, null, { renderer: 'canvas' });
    chartRef.current = instance;

    const handleResize = () => {
      if (chartRef.current) chartRef.current.resize();
    };

    let observer = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(handleResize);
      observer.observe(node);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (observer) observer.disconnect();
      instance.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = chartRef.current;
    if (!instance || !option) return;
    instance.setOption(option, true);
    instance.resize();
  }, [option]);

  const style = typeof height === 'number' ? { height: `${height}px` } : { height };

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      className={`w-full ${className}`}
      style={style}
    />
  );
}
