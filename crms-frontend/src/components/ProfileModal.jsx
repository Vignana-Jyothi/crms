import { useState } from 'react';
import { useAuth } from '../context/authStore';
import { usersApi } from '../api/endpoints';

const PHONE_REGEX = /^[6-9]\d{9}$/;

export default function ProfileModal({ isOpen, onClose }) {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone && user.phone !== '0000000000' ? user.phone : '');
  const [roomNo, setRoomNo] = useState(user?.roomNo || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (phone && !PHONE_REGEX.test(phone)) {
      setError('Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).');
      return;
    }

    setSaving(true);
    try {
      const updated = await usersApi.updateProfile({
        name: name.trim(),
        phone: phone.trim() || undefined,
        roomNo: roomNo.trim() || null
      });
      setUser(prev => ({ ...prev, ...updated }));
      setSuccess('Profile updated successfully!');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  }

  const isPlaceholderPhone = !user?.phone || user.phone === '0000000000';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-line">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h3 className="font-display text-lg font-semibold text-navy">My Profile</h3>
            <p className="text-xs text-ink/60">Update your contact details and room number</p>
          </div>
          <button
            onClick={onClose}
            className="text-ink/40 hover:text-ink text-lg leading-none p-1"
          >
            ✕
          </button>
        </div>

        {isPlaceholderPhone && (
          <div className="mt-3 p-2.5 rounded-lg bg-amber/15 border border-amber/30 text-xs text-amber-900">
            ⚠️ Please add your valid 10-digit contact phone number so department coordinators can reach you for booking confirmations.
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-ink/70 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-line p-2 text-xs focus:border-navy focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink/70 mb-1">Email Address</label>
            <input
              type="email"
              disabled
              value={user?.email || ''}
              className="w-full rounded border border-line bg-paper/60 p-2 text-xs text-ink/60 cursor-not-allowed"
            />
            <p className="text-[10px] text-ink/40 mt-0.5">Email is linked to your Google Account and cannot be changed.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink/70 mb-1">
              Mobile Phone Number <span className="text-brick">*</span>
            </label>
            <input
              type="tel"
              required
              placeholder="e.g. 9876543210"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded border border-line p-2 text-xs font-mono focus:border-navy focus:outline-none"
            />
            <p className="text-[10px] text-ink/50 mt-0.5">10-digit mobile number</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink/70 mb-1">Room / Cabin No. (Optional)</label>
            <input
              type="text"
              placeholder="e.g. D-104 or B-205"
              value={roomNo}
              onChange={(e) => setRoomNo(e.target.value)}
              className="w-full rounded border border-line p-2 text-xs focus:border-navy focus:outline-none"
            />
          </div>

          {error && <p className="text-xs text-brick bg-brick-light p-2 rounded">{error}</p>}
          {success && <p className="text-xs text-forest bg-forest-light p-2 rounded">{success}</p>}

          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-line px-3.5 py-1.5 text-xs font-medium text-ink hover:bg-paper"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-navy px-4 py-1.5 text-xs font-semibold text-white hover:bg-navy-dark disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Details'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
