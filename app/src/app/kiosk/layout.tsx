import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Lead360 Kiosk — Time Clock',
  description: 'Employee kiosk for clock-in and clock-out',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center overflow-hidden select-none">
      {children}
    </div>
  );
}
