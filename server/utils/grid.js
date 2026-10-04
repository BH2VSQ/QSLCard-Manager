/**
 * 网格坐标工具
 * Maidenhead 网格定位系统：四位网格（如 PM01）、六位网格（如 PM01aa）、八位网格（如 PM01aa12）
 * 系统统一按四位网格存储与展示，导入六位/八位网格时自动合并为四位。
 */

/**
 * 将网格坐标归一化为四位网格
 * @param {string} grid - 原始网格坐标（MY_GRIDSQUARE 等）
 * @returns {string} - 四位网格（如 PM01），无效或过短时返回原值
 */
export function normalizeGrid(grid) {
  if (!grid) return '';
  const g = String(grid).trim().toUpperCase();
  if (g.length >= 4) {
    return g.substring(0, 4);
  }
  return g;
}

/**
 * 从日志数组中提取去重后的四位网格列表（优先使用我方网格 my_gridsquare）
 * @param {Array} logs - 日志数组
 * @returns {string[]} - 去重后的四位网格数组（无重复）
 */
export function extractGrids(logs) {
  const grids = [];
  const seen = new Set();
  (logs || []).forEach((log) => {
    const grid = normalizeGrid(log && log.my_gridsquare);
    if (grid && !seen.has(grid)) {
      seen.add(grid);
      grids.push(grid);
    }
  });
  return grids;
}

export default {
  normalizeGrid,
  extractGrids,
};
