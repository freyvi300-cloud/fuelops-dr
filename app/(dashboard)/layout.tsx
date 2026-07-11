import Sidebar from "@/components/dashboard/sidebar"
import MobileNav from "@/components/dashboard/mobile-nav"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#0d1526]">
      <MobileNav />
      {/*
        Fixed 64px spacer — holds the layout slot permanently.
        The Sidebar itself is position:fixed and acts as an overlay,
        so changing its width never affects the flex layout.
      */}
      <div className="hidden md:block w-16 shrink-0" />
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top-bar spacer so content doesn't sit under the hamburger */}
        <div className="md:hidden h-14 shrink-0" />
        {children}
      </div>
    </div>
  )
}
