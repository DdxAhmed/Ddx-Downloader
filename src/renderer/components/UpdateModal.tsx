import React from 'react';
import { UpdateContent, UpdateContentProps } from './UpdateContent';

export const UpdateModal: React.FC<UpdateContentProps> = (props) => (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
    <section
      role="dialog"
      aria-modal="true"
      aria-label={props.lang === 'ar' ? 'تحديث التطبيق' : 'Application update'}
      className="glass-acrylic-card text-white border border-white/[0.1] rounded-3xl max-w-lg w-full p-7 shadow-2xl"
    >
      <UpdateContent {...props} />
    </section>
  </div>
);
