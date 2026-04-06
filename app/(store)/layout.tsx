import Navbar from '@/components/store/Navbar'
import Footer from '@/components/store/Footer'
import AnnouncementBar from '@/components/store/AnnouncementBar'

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  )
}
