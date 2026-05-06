import {useRef} from 'react';
import useModalAccess from '../hooks/useModalAccess.js';

export default function ConfirmDialog({message, confirmLabel = 'Confirm', onConfirm, onCancel}) {
  const rootRef = useRef(null);
  useModalAccess(rootRef, onCancel);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <div
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 border rounded text-sm hover:bg-gray-100"
          >Cancel</button>
          <button
            onClick={onConfirm}
            className="px-4 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
