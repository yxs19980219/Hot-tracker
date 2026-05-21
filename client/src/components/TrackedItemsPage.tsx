import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Satellite, Plus, Trash2, Eye, EyeOff, ExternalLink, Clock,
  RefreshCw, Sparkles, ArrowUpRight, Activity, X, ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  trackedItemsApi,
  type TrackedItem,
  type TrackedItemUpdate
} from '../services/api';
import { relativeTime } from '../utils/relativeTime';

interface Props {
  onToast: (message: string, type: 'success' | 'error') => void;
}

const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  upgrade: { label: '建议升级', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  watch:   { label: '值得关注', color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
  ignore:  { label: '可忽略',   color: 'text-slate-400',  bg: 'bg-slate-500/10 border-slate-500/20' },
  urgent:  { label: '紧急',     color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20' },
};

export default function TrackedItemsPage({ onToast }: Props) {
  const [items, setItems] = useState<TrackedItem[]>([]);
  const [allUpdates, setAllUpdates] = useState<TrackedItemUpdate[]>([]);
  const [itemUpdatesMap, setItemUpdatesMap] = useState<Record<string, TrackedItemUpdate[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState('');
  const [newNote, setNewNote] = useState('');

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await trackedItemsApi.getAll();
      setItems(data);

      // Load updates for each item
      const updatesMap: Record<string, TrackedItemUpdate[]> = {};
      const all: TrackedItemUpdate[] = [];
      for (const item of data) {
        if ((item._count?.updates ?? 0) > 0) {
          try {
            const itemUpdates = await trackedItemsApi.getUpdates(item.id, { limit: 20 });
            updatesMap[item.id] = itemUpdates;
            all.push(...itemUpdates);
          } catch { /* ignore */ }
        }
      }
      // Sort all updates by time desc
      all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setItemUpdatesMap(updatesMap);
      setAllUpdates(all);

      // Auto-select first item with updates if nothing selected
      if (!selectedItemId && data.length > 0) {
        const withUpdates = data.find(d => (d._count?.updates ?? 0) > 0);
        setSelectedItemId(withUpdates?.id ?? data[0].id);
      }
    } catch {
      onToast('加载追踪列表失败', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [onToast, selectedItemId]);

  useEffect(() => {
    loadItems();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    try {
      await trackedItemsApi.create({ url: newUrl.trim(), note: newNote.trim() || undefined });
      setNewUrl('');
      setNewNote('');
      setShowAddModal(false);
      onToast('追踪项添加成功', 'success');
      loadItems();
    } catch (error: any) {
      onToast(error.message || '添加失败', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个追踪项吗？')) return;
    try {
      await trackedItemsApi.delete(id);
      if (selectedItemId === id) setSelectedItemId(null);
      onToast('删除成功', 'success');
      loadItems();
    } catch {
      onToast('删除失败', 'error');
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await trackedItemsApi.toggle(id);
      loadItems();
    } catch {
      onToast('操作失败', 'error');
    }
  };

  const handleManualCheck = async () => {
    setIsChecking(true);
    try {
      await fetch('/api/check-tracking', { method: 'POST' });
      onToast('追踪检查已触发', 'success');
      setTimeout(loadItems, 3000);
    } catch {
      onToast('触发失败', 'error');
    } finally {
      setIsChecking(false);
    }
  };

  const selectedItem = items.find(i => i.id === selectedItemId);
  const displayedUpdates = selectedItemId
    ? (itemUpdatesMap[selectedItemId] ?? [])
    : allUpdates;

  const activeCount = items.filter(i => i.isActive).length;
  const hasUpdatesCount = items.filter(i => (i._count?.updates ?? 0) > 0).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-2xl bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/10"
        >
          <div className="text-slate-500 text-sm mb-2 flex items-center gap-2"><Satellite className="w-4 h-4" />追踪项</div>
          <p className="text-3xl font-bold text-white">{items.length}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/10"
        >
          <div className="text-slate-500 text-sm mb-2 flex items-center gap-2"><Activity className="w-4 h-4" />活跃追踪</div>
          <p className="text-3xl font-bold text-emerald-400">{activeCount}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/10"
        >
          <div className="text-slate-500 text-sm mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4" />有更新</div>
          <p className="text-3xl font-bold text-amber-400">{hasUpdatesCount}</p>
        </motion.div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <motion.button
          onClick={handleManualCheck}
          disabled={isChecking}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all",
            isChecking ? "bg-blue-500/20 text-blue-400 cursor-wait" : "bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5"
          )}
        >
          <RefreshCw className={cn("w-4 h-4", isChecking && "animate-spin")} />
          {isChecking ? '检查中' : '检查更新'}
        </motion.button>

        <motion.button
          onClick={() => setShowAddModal(true)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/25"
        >
          <Plus className="w-4 h-4" />
          添加追踪
        </motion.button>
      </div>

      {/* Two-column layout */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-400 rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600">
          <Satellite className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg font-medium">暂无追踪项</p>
          <p className="text-sm mt-1">点击「添加追踪」开始监控你关注的项目</p>
        </div>
      ) : (
        <div className="flex gap-4 min-h-[600px]">
          {/* Left sidebar: Tracking items list */}
          <div className="w-72 shrink-0 space-y-2">
            <h3 className="text-sm font-medium text-slate-500 px-2 mb-3">我的追踪 ({items.length})</h3>
            {items.map((item) => {
              const isSelected = selectedItemId === item.id;
              const itemUpdates = itemUpdatesMap[item.id] ?? [];
              const latestUpdate = itemUpdates[0];
              const hasNew = (item._count?.updates ?? 0) > 0;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => setSelectedItemId(item.id)}
                  className={cn(
                    "group relative p-3 rounded-xl border cursor-pointer transition-all",
                    isSelected
                      ? "bg-white/[0.06] border-blue-500/30"
                      : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className={cn(
                        "text-sm font-medium truncate",
                        isSelected ? "text-blue-400" : "text-white group-hover:text-blue-400"
                      )}>
                        {item.title}
                      </h4>
                      {item.note && (
                        <p className="text-xs text-slate-600 mt-0.5 truncate">{item.note}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        {hasNew && (
                          <span className="flex items-center gap-1 text-[10px] text-amber-400">
                            <Sparkles className="w-3 h-3" />
                            {item._count?.updates} 更新
                          </span>
                        )}
                        {latestUpdate && (
                          <span className="text-[10px] text-slate-600">
                            {relativeTime(latestUpdate.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <ChevronRight className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    )}
                  </div>

                  {/* Hover actions */}
                  <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggle(item.id); }}
                      className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-500"
                      title={item.isActive ? '暂停' : '恢复'}
                    >
                      {item.isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                      className="p-1 rounded-lg bg-white/5 hover:bg-red-500/10 text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Right main: Update content */}
          <div className="flex-1 min-w-0">
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 min-h-full">
              {selectedItem ? (
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/5">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-white">{selectedItem.title}</h2>
                      <a
                        href={selectedItem.canonicalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        {selectedItem.canonicalUrl}
                      </a>
                      {selectedItem.note && (
                        <p className="text-sm text-slate-500 mt-2">{selectedItem.note}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleToggle(selectedItem.id)}
                        className={cn(
                          "p-2 rounded-xl transition-all",
                          selectedItem.isActive ? "bg-white/5 hover:bg-white/10 text-slate-400" : "bg-white/[0.02] text-slate-600"
                        )}
                      >
                        {selectedItem.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <a
                        href={selectedItem.canonicalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 transition-all"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  {/* Updates */}
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      更新记录 ({displayedUpdates.length})
                    </h3>

                    {displayedUpdates.length === 0 ? (
                      <div className="text-center py-12 text-slate-700">
                        <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">暂无更新记录</p>
                        <p className="text-xs mt-1">系统会定期检查该项目的变化</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {displayedUpdates.map((update) => (
                          <motion.div
                            key={update.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 uppercase">{update.updateType}</span>
                                {update.aiAction && ACTION_CONFIG[update.aiAction] && (
                                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", ACTION_CONFIG[update.aiAction].bg, ACTION_CONFIG[update.aiAction].color)}>
                                    {ACTION_CONFIG[update.aiAction].label}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-600">{relativeTime(update.createdAt)}</span>
                            </div>

                            <h4 className="text-sm font-medium text-white mb-2">{update.title}</h4>

                            {update.aiSummary && (
                              <div className="mb-2 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Sparkles className="w-3 h-3 text-blue-400" />
                                  <span className="text-[10px] text-blue-400/70">AI 分析</span>
                                </div>
                                <p className="text-sm text-slate-400">{update.aiSummary}</p>
                              </div>
                            )}

                            <p className="text-xs text-slate-600 line-clamp-3">{update.content}</p>

                            {update.sourceUrl && (
                              <a
                                href={update.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-2"
                              >
                                <ExternalLink className="w-3 h-3" />
                                查看来源
                              </a>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 text-slate-600">
                  <Satellite className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">选择一个追踪项查看更新</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg mx-4 p-6 rounded-2xl bg-[#0a0a1a]/95 border border-white/10 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Satellite className="w-5 h-5 text-blue-400" />
                  添加追踪项
                </h2>
                <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">链接地址</label>
                  <input
                    type="url"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">备注（可选）</label>
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="例如：React 官方仓库"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-sm font-medium transition-all"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-medium shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all"
                  >
                    添加追踪
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
