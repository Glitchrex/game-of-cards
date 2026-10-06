import { Badge, type BadgeSize, type BadgeTone } from '@/components/ui/Badge';
import { type PostStatus, type PostType } from '@/lib/api-client';
import { t } from '@/lib/i18n';
import { StatusIcon, TypeIcon } from './icons';

const STATUS_TONES: Record<PostStatus, BadgeTone> = {
  open: 'mist',
  planned: 'ivory',
  'in-progress': 'gold',
  done: 'felt',
};

export function postTypeLabel(type: PostType): string {
  return t(`community.types.${type}`);
}

export function postStatusLabel(status: PostStatus): string {
  return t(`community.statuses.${status}`);
}

export interface PostTypeBadgeProps {
  type: PostType;
  size?: BadgeSize;
  className?: string;
}

/** "Feature request" / "Bug" / "Game request" / "General feedback" with its own icon. */
export function PostTypeBadge({ type, size = 'md', className }: PostTypeBadgeProps) {
  return (
    <Badge
      tone="outline"
      size={size}
      icon={<TypeIcon type={type} size={size === 'sm' ? 12 : 14} />}
      className={className}
      data-type={type}
    >
      {postTypeLabel(type)}
    </Badge>
  );
}

export interface PostStatusBadgeProps {
  status: PostStatus;
  size?: BadgeSize;
  className?: string;
}

/** Open / Planned / In progress / Done — distinct tone AND distinct icon. */
export function PostStatusBadge({ status, size = 'md', className }: PostStatusBadgeProps) {
  return (
    <Badge
      tone={STATUS_TONES[status]}
      size={size}
      icon={<StatusIcon status={status} size={size === 'sm' ? 12 : 14} />}
      className={className}
      data-status={status}
    >
      {postStatusLabel(status)}
    </Badge>
  );
}
