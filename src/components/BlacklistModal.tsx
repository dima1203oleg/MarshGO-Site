import React, { useState, useEffect } from 'react';
import {
  Ban,
  X,
  UserX,
  ShieldAlert,
  Search,
  Trash2,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Info,
  Car,
  Users,
  Calendar
} from 'lucide-react';
import { BlockedUser } from '../types';
import {
  getBlacklist,
  blockUser,
  unblockUser,
  subscribeToBlacklistChanges
} from '../services/blacklist';

interface BlacklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBlacklistUpdated?: () => void;
}

const COMMON_REASONS = [
  'Небезпечний стиль водіння / порушення ПДР',
  'Скасування поїздки в останню мить',
  'Некоректне або грубе спілкування',
  'Паління або бруд у салоні без згоди',
  'Спроба підвищити ціну на місці посадки',
  'Систематичне запізнення без попередження',
  'Інша причина'
];

const SUGGESTED_DRIVERS = [
  { name: 'Сергій Романюк', role: 'driver' as const, phone: '+380 67 333 4455' },
  { name: 'Михайло Коваль', role: 'driver' as const, phone: '+380 93 111 9988' },
  { name: 'Богдан Васильчук', role: 'driver' as const, phone: '+380 50 777 8899' }
];

export const BlacklistModal: React.FC<BlacklistModalProps> = ({
  isOpen,
  onClose,
  onBlacklistUpdated
}) => {
  const [blacklist, setBlacklist] = useState<BlockedUser[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');
  const [roleFilter, setRoleFilter] = useState<'all' | 'driver' | 'passenger'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Block Form State
  const [newUserName, setNewUserName] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState<'driver' | 'passenger'>('driver');
  const [newReason, setNewReason] = useState(COMMON_REASONS[0]);
  const [newNotes, setNewNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Load blacklist
  useEffect(() => {
    if (isOpen) {
      setBlacklist(getBlacklist());
    }
  }, [isOpen]);

  useEffect(() => {
    const unsubscribe = subscribeToBlacklistChanges((updated) => {
      setBlacklist(updated);
      if (onBlacklistUpdated) onBlacklistUpdated();
    });
    return unsubscribe;
  }, [onBlacklistUpdated]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleUnblock = (user: BlockedUser) => {
    if (window.confirm(`Розблокувати користувача ${user.name}? Його пропозиції знову будуть видимі у вашому пошуку.`)) {
      unblockUser(user.id);
      showToast(`Користувача ${user.name} вилучено з чорного списку`);
    }
  };

  const handleAddBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) {
      setFormError('Введіть ім’я або позивний користувача');
      return;
    }

    blockUser({
      name: newUserName.trim(),
      phone: newUserPhone.trim(),
      role: newUserRole,
      reason: newReason,
      notes: newNotes.trim()
    });

    showToast(`Користувача ${newUserName.trim()} додано до чорного списку`);
    setNewUserName('');
    setNewUserPhone('');
    setNewNotes('');
    setFormError('');
    setActiveTab('list');
  };

  if (!isOpen) return null;

  // Filtered blacklist
  const filteredList = blacklist.filter((b) => {
    const matchesRole = roleFilter === 'all' || b.role === roleFilter;
    const matchesSearch =
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.phone && b.phone.includes(searchQuery)) ||
      b.reason.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white dark:bg-[#0D1E36] w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toast Alert */}
        {toastMessage && (
          <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 text-center animate-fadeIn">
            {toastMessage}
          </div>
        )}

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#14243B] dark:text-white flex items-center gap-2">
                <span>Чорний список</span>
                <span className="text-xs font-black bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full">
                  {blacklist.length}
                </span>
              </h2>
              <p className="text-xs text-[#62718A] dark:text-slate-400">
                Ігнорування пропозицій від небажаних водіїв або пасажирів
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            aria-label="Закрити"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 pt-2 bg-slate-50 dark:bg-[#0A1A30]">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`pb-2.5 px-4 font-bold text-xs sm:text-sm border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'list'
                ? 'border-red-600 text-red-600 dark:text-red-400 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <UserX className="w-4 h-4" />
            <span>Заблоковані ({blacklist.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('add')}
            className={`pb-2.5 px-4 font-bold text-xs sm:text-sm border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'add'
                ? 'border-red-600 text-red-600 dark:text-red-400 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>+ Заблокувати користувача</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {activeTab === 'list' ? (
            <>
              {/* Filter and Search Toolbar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setRoleFilter('all')}
                    className={`px-3 py-1 rounded-lg font-bold transition flex-1 sm:flex-none ${
                      roleFilter === 'all'
                        ? 'bg-white dark:bg-[#0D1E36] text-[#14243B] dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Всі ({blacklist.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter('driver')}
                    className={`px-3 py-1 rounded-lg font-bold transition flex-1 sm:flex-none ${
                      roleFilter === 'driver'
                        ? 'bg-white dark:bg-[#0D1E36] text-[#14243B] dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Водії ({blacklist.filter((b) => b.role === 'driver').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter('passenger')}
                    className={`px-3 py-1 rounded-lg font-bold transition flex-1 sm:flex-none ${
                      roleFilter === 'passenger'
                        ? 'bg-white dark:bg-[#0D1E36] text-[#14243B] dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Пасажири ({blacklist.filter((b) => b.role === 'passenger').length})
                  </button>
                </div>

                <div className="relative w-full sm:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Пошук у чорному списку..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-[#0A1A30] border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-red-500 text-[#14243B] dark:text-white"
                  />
                </div>
              </div>

              {/* Blocked Users Cards */}
              {filteredList.length > 0 ? (
                <div className="space-y-3">
                  {filteredList.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border border-red-200/60 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition hover:shadow-xs"
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative">
                          <img
                            src={item.avatar}
                            alt={item.name}
                            className="w-11 h-11 rounded-full object-cover border-2 border-red-300 dark:border-red-800"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute -bottom-1 -right-1 bg-red-600 text-white rounded-full p-0.5 shadow-xs">
                            <Ban className="w-3 h-3" />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-extrabold text-sm text-[#14243B] dark:text-white">
                              {item.name}
                            </h4>
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                                item.role === 'driver'
                                  ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300'
                                  : 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                              }`}
                            >
                              {item.role === 'driver' ? 'Водій' : 'Пасажир'}
                            </span>
                            {item.phone && (
                              <span className="text-xs text-slate-500 font-mono">
                                {item.phone}
                              </span>
                            )}
                          </div>

                          <div className="mt-1 text-xs text-red-700 dark:text-red-300 font-medium flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>{item.reason}</span>
                          </div>

                          {item.notes && (
                            <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 italic">
                              «{item.notes}»
                            </p>
                          )}

                          <div className="mt-1 text-[10px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>
                              Заблоковано {new Date(item.blockedAt).toLocaleDateString('uk-UA')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleUnblock(item)}
                        className="self-end sm:self-center px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D1E36] hover:bg-red-50 dark:hover:bg-red-950 text-slate-700 dark:text-slate-200 hover:text-red-600 text-xs font-bold transition flex items-center gap-1.5 shrink-0 active:scale-95 shadow-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Розблокувати</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 px-4 bg-[#F5F8FD] dark:bg-[#0A1A30] rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="font-extrabold text-sm text-[#14243B] dark:text-white">
                    {searchQuery ? 'Користувачів не знайдено' : 'Чорний список порожній'}
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {searchQuery
                      ? 'Спробуйте змінити пошуковий запит або скинути фільтр.'
                      : 'Усі водії та попутники доступні для взаємодії. Якщо у вас виникне небажаний контакт, ви завжди можете додати користувача сюди.'}
                  </p>
                </div>
              )}
            </>
          ) : (
            /* Add Block Form */
            <form onSubmit={handleAddBlock} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-100 dark:bg-red-950 border border-red-200 text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Role Toggle */}
              <div>
                <label className="block text-xs font-extrabold text-[#14243B] dark:text-slate-200 mb-1.5">
                  Тип користувача:
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setNewUserRole('driver')}
                    className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-2 transition ${
                      newUserRole === 'driver'
                        ? 'bg-red-500 text-white border-red-500 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Car className="w-4 h-4" />
                    <span>Водій (приховати його рейси)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewUserRole('passenger')}
                    className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-2 transition ${
                      newUserRole === 'passenger'
                        ? 'bg-red-500 text-white border-red-500 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Пасажир (заборонити бронювання)</span>
                  </button>
                </div>
              </div>

              {/* User Name */}
              <div>
                <label className="block text-xs font-extrabold text-[#14243B] dark:text-slate-200 mb-1">
                  Ім’я або позивний користувача *
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => {
                    setNewUserName(e.target.value);
                    if (formError) setFormError('');
                  }}
                  placeholder="Наприклад: Віктор Кравченко"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-[#0A1A30] border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-red-500 text-[#14243B] dark:text-white"
                />

                {/* Quick suggestions */}
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-semibold">Швидкий вибір:</span>
                  {SUGGESTED_DRIVERS.map((sug) => (
                    <button
                      key={sug.name}
                      type="button"
                      onClick={() => {
                        setNewUserName(sug.name);
                        setNewUserPhone(sug.phone);
                        setNewUserRole(sug.role);
                      }}
                      className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-red-50 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:text-red-600 transition"
                    >
                      {sug.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* User Phone (optional) */}
              <div>
                <label className="block text-xs font-extrabold text-[#14243B] dark:text-slate-200 mb-1">
                  Номер телефону (необов’язково)
                </label>
                <input
                  type="text"
                  value={newUserPhone}
                  onChange={(e) => setNewUserPhone(e.target.value)}
                  placeholder="+380 67 000 0000"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-[#0A1A30] border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-red-500 text-[#14243B] dark:text-white font-mono"
                />
              </div>

              {/* Reason Selector */}
              <div>
                <label className="block text-xs font-extrabold text-[#14243B] dark:text-slate-200 mb-1">
                  Причина блокування *
                </label>
                <select
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-[#0A1A30] border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-red-500 text-[#14243B] dark:text-white"
                >
                  {COMMON_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Personal Notes */}
              <div>
                <label className="block text-xs font-extrabold text-[#14243B] dark:text-slate-200 mb-1">
                  Особистий коментар (видимий лише вам)
                </label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Вкажіть деталі інциденту для себе..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-[#0A1A30] border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-red-500 text-[#14243B] dark:text-white resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-md active:scale-95 transition flex items-center gap-1.5"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Додати до чорного списку</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer Policy Note */}
        <div className="p-3.5 bg-slate-50 dark:bg-[#0A1A30] border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <Info className="w-4 h-4 text-[#1769F4] shrink-0" />
          <span>
            Користувачі не сповіщаються про потрапляння у ваш чорний список. Пропозиції заблокованих водіїв виключаються з видачі пошуку.
          </span>
        </div>
      </div>
    </div>
  );
};
