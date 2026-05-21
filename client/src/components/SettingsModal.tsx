import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Key, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { settingsApi } from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [savedKeyMask, setSavedKeyMask] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const settings = await settingsApi.getAll();
      const mask = settings.deepseekApiKey || '';
      setSavedKeyMask(mask);
      setHasKey(!!mask && mask.includes('*'));
      setApiKey('');
      // 自动检查 AI 状态
      checkAi();
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const checkAi = async () => {
    setChecking(true);
    try {
      const result = await settingsApi.checkAi();
      setAiStatus({ ok: result.ok, message: result.message });
    } catch (error) {
      setAiStatus({ ok: false, message: '检查失败' });
    } finally {
      setChecking(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      showToast('请输入 API Key', 'error');
      return;
    }
    setSaving(true);
    try {
      await settingsApi.update({ deepseekApiKey: apiKey.trim() });
      setSavedKeyMask(apiKey.trim().slice(0, 6) + '****' + apiKey.trim().slice(-4));
      setHasKey(true);
      setApiKey('');
      showToast('API Key 保存成功', 'success');
      await checkAi();
    } catch (error) {
      showToast('保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await settingsApi.update({ deepseekApiKey: '' });
      setSavedKeyMask('');
      setHasKey(false);
      setApiKey('');
      showToast('API Key 已清除', 'success');
      setAiStatus(null);
    } catch (error) {
      showToast('清除失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md"
          >
            <div className="bg-[#0a0a1a]/95 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <h3 className="text-lg font-semibold text-white">设置</h3>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 space-y-6">
                {/* API Key Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Key className="w-4 h-4 text-blue-400" />
                    DeepSeek API Key
                  </div>

                  {hasKey && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm text-emerald-400 font-mono">{savedKeyMask}</span>
                      <span className="text-xs text-emerald-500/60 ml-auto">已保存</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={hasKey ? '输入新 Key 替换现有配置' : 'sk-xxxxxxxxxxxxxxxx'}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSave}
                        disabled={saving || !apiKey.trim()}
                        className={cn(
                          "flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                          saving || !apiKey.trim()
                            ? "bg-white/5 text-slate-600 cursor-not-allowed"
                            : "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20"
                        )}
                      >
                        {saving ? '保存中...' : '保存'}
                      </button>
                      {hasKey && (
                        <button
                          onClick={handleClear}
                          disabled={saving}
                          className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-white/5 transition-all"
                        >
                          清除
                        </button>
                      )}
                    </div>
                  </div>

                  {/* AI Status */}
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                    {checking ? (
                      <>
                        <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
                        <span className="text-xs text-slate-500">检查 AI 服务状态中...</span>
                      </>
                    ) : aiStatus ? (
                      <>
                        {aiStatus.ok ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                        )}
                        <span className={cn("text-xs", aiStatus.ok ? "text-emerald-400" : "text-amber-400")}>
                          {aiStatus.message}
                        </span>
                        <button
                          onClick={checkAi}
                          className="ml-auto text-[10px] text-slate-500 hover:text-blue-400 transition-colors"
                        >
                          重新检查
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-slate-500">等待配置...</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Toast */}
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={cn(
                  "fixed top-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl backdrop-blur-xl flex items-center gap-3 shadow-2xl",
                  toast.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                )}
              >
                {toast.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                <span className="text-sm font-medium">{toast.message}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
