import { Mail, MapPin, Phone, ShieldAlert } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-mudra-200 bg-white p-6 sm:p-12 shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[#0b192c] ring-3 ring-amber-400/70 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mudrapublications_logo.jpeg"
              alt="Mudra Publications Official Logo"
              width={64}
              height={64}
              className="h-full w-full object-cover scale-105"
            />
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mudra-100 px-3 py-1 text-xs font-semibold text-mudra-800">
              Contact &amp; Subscription Desk
            </span>
            <h1 className="mt-1.5 font-serif text-2xl sm:text-3xl font-bold text-mudra-950">
              Contact Mudra Publications
            </h1>
          </div>
        </div>

        <p className="mt-2 text-sm text-mudra-700 leading-relaxed">
          Public self-registration is disabled. To request a Reader account, password reset, or
          institutional access for your office, please contact the Mudra Publications Editorial &amp;
          Administration Desk.
        </p>

        <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className="rounded-2xl border border-mudra-200 bg-parchment-50 p-5">
            <MapPin className="h-5 w-5 text-mudra-700 mb-2" />
            <h2 className="text-sm font-bold text-mudra-950">Editorial Office</h2>
            <p className="mt-1 text-xs text-mudra-700 leading-relaxed">
              Mudra Publications, Statue Junction, Thiruvananthapuram, Kerala 695001
            </p>
          </div>

          <div className="rounded-2xl border border-mudra-200 bg-parchment-50 p-5">
            <Phone className="h-5 w-5 text-mudra-700 mb-2" />
            <h2 className="text-sm font-bold text-mudra-950">Subscriber Helpline</h2>
            <p className="mt-1 text-xs text-mudra-700 leading-relaxed">
              +91 471 247 8890
              <br />
              Mon – Sat, 9:30 AM to 5:30 PM IST
            </p>
          </div>

          <div className="rounded-2xl border border-mudra-200 bg-parchment-50 p-5">
            <Mail className="h-5 w-5 text-mudra-700 mb-2" />
            <h2 className="text-sm font-bold text-mudra-950">Email Desk</h2>
            <p className="mt-1 text-xs text-mudra-700 leading-relaxed">
              desk@mudrapublications.in
              <br />
              support@mudrapublications.in
            </p>
          </div>
        </div>

        <div className="mt-7 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50/70 p-4 text-xs text-mudra-900">
          <ShieldAlert className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Account Provisioning &amp; First-Login Security Policy</p>
            <p className="mt-1 text-mudra-700 leading-relaxed">
              When an administrator creates your Reader account or issues a temporary password reset,
              you will be prompted to set a personal password on your first sign-in before accessing
              any library documents.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
