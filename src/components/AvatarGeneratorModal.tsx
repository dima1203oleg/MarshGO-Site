import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Dices,
  Check,
  Palette,
  Glasses,
  Smile,
  ShieldCheck
} from 'lucide-react';
import {
  generateAvatarSvg,
  PRESET_AVATARS,
  AvatarOptions,
  CuratedAvatar
} from '../services/avatarGenerator';

interface AvatarGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatar: string;
  userName: string;
  onSaveAvatar: (avatarDataUri: string) => void;
}

export const AvatarGeneratorModal: React.FC<AvatarGeneratorModalProps> = ({
  isOpen,
  onClose,
  currentAvatar: _currentAvatar,
  userName,
  onSaveAvatar
}) => {
  const [selectedPalette, setSelectedPalette] = useState<string>('blue');
  const [selectedAccessory, setSelectedAccessory] = useState<AvatarOptions['accessory']>('sunglasses');
  const [selectedExpression, setSelectedExpression] = useState<AvatarOptions['expression']>('smile');
  const [randomSeed, setRandomSeed] = useState<string>(() => `${userName}_${Date.now()}`);

  const [previewAvatar, setPreviewAvatar] = useState<string>(() =>
    generateAvatarSvg(userName, {
      palette: 'blue',
      accessory: 'sunglasses',
      expression: 'smile'
    })
  );

  if (!isOpen) return null;

  const handleShuffle = () => {
    const palettes = ['blue', 'emerald', 'amber', 'purple', 'sunset', 'ukraine'];
    const accessories: AvatarOptions['accessory'][] = ['none', 'glasses', 'headphones', 'sunglasses', 'cap'];
    const expressions: AvatarOptions['expression'][] = ['smile', 'cool', 'wink', 'friendly'];

    const newPal = palettes[Math.floor(Math.random() * palettes.length)];
    const newAcc = accessories[Math.floor(Math.random() * accessories.length)];
    const newExp = expressions[Math.floor(Math.random() * expressions.length)];
    const newSeed = `seed_${Date.now()}_${Math.random()}`;

    setSelectedPalette(newPal);
    setSelectedAccessory(newAcc);
    setSelectedExpression(newExp);
    setRandomSeed(newSeed);

    const generated = generateAvatarSvg(newSeed, {
      palette: newPal,
      accessory: newAcc,
      expression: newExp
    });
    setPreviewAvatar(generated);
  };

  const handleSelectPreset = (preset: CuratedAvatar) => {
    setSelectedPalette(preset.palette || 'blue');
    setSelectedAccessory(preset.accessory || 'none');
    setSelectedExpression(preset.expression || 'smile');
    setPreviewAvatar(preset.svgDataUri);
  };

  const handleUpdateCustom = (
    pal = selectedPalette,
    acc = selectedAccessory,
    exp = selectedExpression
  ) => {
    setSelectedPalette(pal);
    setSelectedAccessory(acc);
    setSelectedExpression(exp);
    const updated = generateAvatarSvg(randomSeed, {
      palette: pal,
      accessory: acc,
      expression: exp
    });
    setPreviewAvatar(updated);
  };

  const handleSave = () => {
    onSaveAvatar(previewAvatar);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-[#F5F8FD]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-100 text-[#1769F4]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#14243B]">Генератор унікального аватара</h3>
              <p className="text-xs text-[#62718A]">Створіть свій персональний стиль для поїздок</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Main Avatar Preview Box */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 p-6 rounded-2xl bg-gradient-to-b from-blue-50/50 to-indigo-50/30 border border-blue-100">
            <div className="relative">
              <img
                src={previewAvatar}
                alt="Згенерований аватар"
                className="w-28 h-28 rounded-full shadow-lg border-4 border-white object-cover"
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-0 right-0 p-1.5 bg-[#16845C] text-white rounded-full shadow-md" title="Верифікований стиль">
                <ShieldCheck className="w-4 h-4" />
              </span>
            </div>

            <div className="text-center sm:text-left space-y-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#1769F4]">
                  Персональний аватар
                </span>
                <h4 className="font-black text-lg text-[#14243B]">{userName}</h4>
                <p className="text-xs text-slate-500">
                  Унікальний векторний профіль без необхідності завантажувати власне фото
                </p>
              </div>

              <button
                type="button"
                onClick={handleShuffle}
                className="px-4 py-2 rounded-xl bg-white hover:bg-blue-50 border border-blue-200 text-[#1769F4] font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition active:scale-95"
              >
                <Dices className="w-4 h-4" />
                <span>Згенерувати новий вигляд</span>
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#14243B] block">
              Готові стилі мандрівників:
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {PRESET_AVATARS.map((preset) => {
                const isSelected = previewAvatar === preset.svgDataUri;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                      isSelected
                        ? 'border-[#1769F4] bg-blue-50 ring-2 ring-[#1769F4]/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <img
                      src={preset.svgDataUri}
                      alt={preset.title}
                      className="w-10 h-10 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <span className="text-[10px] font-bold text-[#14243B] text-center truncate w-full">
                      {preset.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Customization Controls */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            {/* Palette */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#14243B]">
                <Palette className="w-3.5 h-3.5 text-[#1769F4]" />
                <span>Колірна тема:</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { id: 'blue', label: 'Синій Сапфір' },
                  { id: 'ukraine', label: 'UA Синьо-Жовтий' },
                  { id: 'emerald', label: 'Смарагдовий' },
                  { id: 'amber', label: 'Бурштиновий' },
                  { id: 'purple', label: 'Фіолетовий' },
                  { id: 'sunset', label: 'Захід сонця' }
                ].map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => handleUpdateCustom(col.id, selectedAccessory, selectedExpression)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                      selectedPalette === col.id
                        ? 'bg-[#1769F4] text-white border-[#1769F4]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {col.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Accessory */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#14243B]">
                <Glasses className="w-3.5 h-3.5 text-[#1769F4]" />
                <span>Аксесуар:</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { id: 'none', label: 'Без аксесуарів' },
                  { id: 'sunglasses', label: 'Сонцезахисні окуляри' },
                  { id: 'glasses', label: 'Окуляри для читання' },
                  { id: 'headphones', label: 'Навушники' },
                  { id: 'cap', label: 'Кепка' }
                ].map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleUpdateCustom(selectedPalette, acc.id as AvatarOptions['accessory'], selectedExpression)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                      selectedAccessory === acc.id
                        ? 'bg-[#1769F4] text-white border-[#1769F4]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Expression */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#14243B]">
                <Smile className="w-3.5 h-3.5 text-[#1769F4]" />
                <span>Настрій:</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { id: 'smile', label: 'Усміхнений' },
                  { id: 'friendly', label: 'Привітний' },
                  { id: 'wink', label: 'Підморгування' },
                  { id: 'cool', label: 'Впевнений' }
                ].map((exp) => (
                  <button
                    key={exp.id}
                    type="button"
                    onClick={() => handleUpdateCustom(selectedPalette, selectedAccessory, exp.id as AvatarOptions['expression'])}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                      selectedExpression === exp.id
                        ? 'bg-[#1769F4] text-white border-[#1769F4]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {exp.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-[#F5F8FD] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition"
          >
            Скасувати
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-[#1769F4] hover:bg-[#1358CE] text-white font-bold text-xs shadow-md shadow-[#1769F4]/20 flex items-center gap-2 transition active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>Встановити цей аватар</span>
          </button>
        </div>
      </div>
    </div>
  );
};
