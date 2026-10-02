import React, { useState } from 'react';
import { generateAvatarSvg } from '../services/avatarGenerator';

interface UserAvatarProps {
  src?: string;
  name: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
  title?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name,
  className = '',
  size = 'md',
  onClick,
  title
}) => {
  const [hasError, setHasError] = useState(false);

  // If no source or failed to load, automatically use unique procedural avatar based on name
  const effectiveSrc = (!src || hasError) ? generateAvatarSvg(name) : src;

  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20'
  }[size];

  return (
    <img
      src={effectiveSrc}
      alt={name || 'Користувач'}
      title={title || name}
      onClick={onClick}
      onError={() => setHasError(true)}
      className={`rounded-full object-cover shrink-0 select-none ${sizeClasses} ${className}`}
      referrerPolicy="no-referrer"
    />
  );
};
