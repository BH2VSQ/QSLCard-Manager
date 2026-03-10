import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 主题状态管理
 * 支持暗黑/白天模式切换，并持久化到 localStorage
 */
const useThemeStore = create(
  persist(
    (set) => ({
      theme: 'light', // 默认白天模式
      
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'light' ? 'dark' : 'light',
        })),
      
      setTheme: (theme) =>
        set({ theme }),
    }),
    {
      name: 'qsl-theme-storage',
    }
  )
);

export default useThemeStore;
