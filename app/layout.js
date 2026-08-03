import { Fraunces, Work_Sans } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/AuthProvider'

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-display' })
const workSans = Work_Sans({ subsets: ['latin'], variable: '--font-sans' })

export const metadata = {
  title: 'The Compound',
  description: 'Our family homestead, tracked together.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${workSans.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
