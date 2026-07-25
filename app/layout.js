import './globals.css'
import { AuthProvider } from '@/lib/AuthProvider'

export const metadata = {
  title: 'The Compound',
  description: 'Our family homestead, tracked together.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
