import { get, set, del, keys, clear } from "idb-keyval";

export interface CachedPage {
  id: string;
  title: string;
  content: any;
  updatedAt: string;
  workspaceId: string;
}

const PAGE_PREFIX = "page:";

export const cacheManager = {
  async getPage(pageId: string): Promise<CachedPage | undefined> {
    return get<CachedPage>(`${PAGE_PREFIX}${pageId}`);
  },

  async setPage(page: CachedPage): Promise<void> {
    await set(`${PAGE_PREFIX}${page.id}`, page);
  },

  async deletePage(pageId: string): Promise<void> {
    await del(`${PAGE_PREFIX}${pageId}`);
  },

  async getAllPages(): Promise<CachedPage[]> {
    const allKeys = await keys();
    const pageKeys = allKeys.filter((k) => String(k).startsWith(PAGE_PREFIX));
    const pages: CachedPage[] = [];
    for (const key of pageKeys) {
      const page = await get<CachedPage>(key);
      if (page) pages.push(page);
    }
    return pages;
  },

  async getPagesByWorkspace(workspaceId: string): Promise<CachedPage[]> {
    const all = await this.getAllPages();
    return all.filter((p) => p.workspaceId === workspaceId);
  },

  async clearAll(): Promise<void> {
    await clear();
  },

  async getCacheSize(): Promise<number> {
    const allKeys = await keys();
    return allKeys.filter((k) => String(k).startsWith(PAGE_PREFIX)).length;
  },
};
