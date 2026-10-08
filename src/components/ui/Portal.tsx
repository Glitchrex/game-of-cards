'use client';
import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useIsClient } from './hooks';

/** Renders children into document.body (client only; nothing on the server). */
export function Portal({ children }: { children: ReactNode }) {
  const isClient = useIsClient();
  if (!isClient) return null;
  return createPortal(children, document.body);
}
